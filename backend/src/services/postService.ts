import { randomUUID } from "node:crypto";

import { bboxAround, coarsen, encodeGeohash, geohashesCoveringBBox, haversineM } from "../core/geo.js";
import { extractExif, isJpeg, stripJpegMetadata } from "../core/media.js";
import { aggregatePins } from "../core/pins.js";
import { feedScore } from "../core/ranking.js";
import { toPublicPost, type BBox, type CaptureTimeSource, type LatLng, type Post, type PublicPost } from "../core/types.js";
import { verify } from "../core/verification.js";
import { GEO_INDEX_PRECISION, type PostRepository } from "../repo/postRepository.js";
import { MAX_UPLOAD_BYTES, publicKeyFor, uploadKeyFor, type MediaStorage, type UploadTarget } from "../storage/mediaStorage.js";

export type AuthUser = { userId: string; nickname: string };

export type CreatePostInput = {
  mediaType: "text" | "image";
  caption: string;
  tags: string[];
  placeName: string;
  location: LatLng;
  device: (LatLng & { accuracyM?: number | null }) | null;
  clientCapturedAt?: string | null;
  clientUtcOffsetMinutes?: number | null;
};

export class AppError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 429,
    message: string
  ) {
    super(message);
  }
}

export const LIMITS = {
  realtimeWindowHours: 24,
  postsPer10Min: 10,
  geoCellsMax: 24,
  perCellQueryLimit: 200,
  recentQueryLimit: 1000
};

export class PostService {
  constructor(
    private repo: PostRepository,
    private storage: MediaStorage,
    private clock: () => Date = () => new Date()
  ) {}

  async createPost(user: AuthUser, input: CreatePostInput): Promise<{ post: PublicPost; upload: UploadTarget | null }> {
    const now = this.clock();
    await this.enforceRateLimit(user.userId, now);

    const id = randomUUID();
    // Public location is coarsened (~110m) so exact positions of users are never published
    const publicLocation = coarsen(input.location);
    const post: Post = {
      id,
      userId: user.userId,
      nickname: user.nickname,
      mediaType: input.mediaType,
      caption: input.caption.trim(),
      tags: [...new Set(input.tags.map((t) => t.trim()).filter(Boolean))],
      placeName: input.placeName.trim(),
      location: publicLocation,
      geohash: encodeGeohash(input.location.lat, input.location.lng, 7),
      claimedLocation: { lat: input.location.lat, lng: input.location.lng },
      deviceLocation: input.device ? { lat: input.device.lat, lng: input.device.lng } : null,
      deviceAccuracyM: input.device?.accuracyM ?? null,
      clientCapturedAt: input.clientCapturedAt ?? null,
      clientUtcOffsetMinutes: input.clientUtcOffsetMinutes ?? null,
      mediaKey: null,
      mediaUrl: null,
      status: "pending_media",
      verification: null,
      likeCount: 0,
      createdAt: now.toISOString(),
      publishedAt: null
    };

    if (input.mediaType === "text") {
      // Text has no capture metadata: the server receive time IS the capture time.
      post.verification = verify({
        claimed: input.location,
        device: post.deviceLocation,
        deviceAccuracyM: post.deviceAccuracyM,
        receivedAt: now,
        capturedAt: now,
        captureTimeSource: "server_receive",
        exifGps: null
      });
      post.status = "published";
      post.publishedAt = now.toISOString();
      await this.repo.create(post);
      return { post: toPublicPost(post), upload: null };
    }

    post.mediaKey = uploadKeyFor(id);
    await this.repo.create(post);
    const upload = await this.storage.createUpload(post.mediaKey, "image/jpeg", MAX_UPLOAD_BYTES);
    return { post: toPublicPost(post), upload };
  }

  /**
   * Called when the original photo lands in upload storage (S3 event in AWS).
   * `receivedAt` must come from the storage service, not the client.
   */
  async processUpload(postId: string, receivedAt: Date): Promise<Post | null> {
    const post = await this.repo.get(postId);
    if (!post || post.status !== "pending_media" || !post.mediaKey) return post;

    const bytes = await this.storage.getUpload(post.mediaKey);
    if (!isJpeg(bytes)) {
      post.status = "rejected";
      post.verification = {
        status: "unverified",
        score: 0,
        capturedAt: null,
        captureTimeSource: "none",
        receivedAt: receivedAt.toISOString(),
        captureAgeMinutes: null,
        deviceDistanceM: null,
        exifGpsDistanceM: null,
        reasons: ["JPEG 형식이 아님"]
      };
      await this.repo.save(post);
      await this.storage.deleteUpload(post.mediaKey);
      return post;
    }

    const exif = await extractExif(bytes, post.clientUtcOffsetMinutes);
    let capturedAt: Date | null = null;
    let source: CaptureTimeSource = "none";
    if (exif.capturedAt) {
      capturedAt = exif.capturedAt;
      source = "file_exif";
    } else if (post.clientCapturedAt) {
      const d = new Date(post.clientCapturedAt);
      if (!Number.isNaN(d.getTime())) {
        capturedAt = d;
        source = "client_exif";
      }
    }

    post.verification = verify({
      claimed: post.claimedLocation,
      device: post.deviceLocation,
      deviceAccuracyM: post.deviceAccuracyM,
      receivedAt,
      capturedAt,
      captureTimeSource: source,
      exifGps: exif.gps
    });

    const publicKey = publicKeyFor(post.id);
    await this.storage.putPublic(publicKey, stripJpegMetadata(bytes, exif.orientation), "image/jpeg");
    post.mediaUrl = this.storage.publicUrl(publicKey);
    post.status = "published";
    post.publishedAt = receivedAt.toISOString();
    await this.repo.save(post);
    await this.storage.deleteUpload(post.mediaKey);
    return post;
  }

  async getPost(id: string) {
    const post = await this.repo.get(id);
    if (!post) throw new AppError(404, "게시물을 찾을 수 없습니다");
    return toPublicPost(post);
  }

  async getPosts(ids: string[]) {
    const now = this.clock();
    return (await this.repo.getMany(ids))
      .filter((p) => p.status === "published")
      .map((p) => ({ ...toPublicPost(p), feedScore: round(feedScore(p, now)) }))
      .sort((a, b) => (b.feedScore ?? 0) - (a.feedScore ?? 0));
  }

  async mapPins(bbox: BBox, windowHours = LIMITS.realtimeWindowHours) {
    const now = this.clock();
    const since = new Date(now.getTime() - windowHours * 3_600_000);
    const posts = await this.postsInBBox(bbox, since);
    return { pins: aggregatePins(posts, bbox, now), scanned: posts.length, since: since.toISOString() };
  }

  async nearby(center: LatLng, radiusM: number, limit = 30) {
    const now = this.clock();
    const since = new Date(now.getTime() - LIMITS.realtimeWindowHours * 3_600_000);
    const posts = await this.postsInBBox(bboxAround(center, radiusM), since);
    return posts
      .map((p) => ({ post: p, distanceM: haversineM(center, p.location) }))
      .filter((x) => x.distanceM <= radiusM)
      .map(({ post, distanceM }) => ({
        ...toPublicPost(post),
        distanceM: Math.round(distanceM),
        feedScore: round(feedScore(post, now))
      }))
      .sort((a, b) => b.feedScore - a.feedScore)
      .slice(0, limit);
  }

  async popular(limit = 20) {
    const now = this.clock();
    const since = new Date(now.getTime() - LIMITS.realtimeWindowHours * 3_600_000);
    const recent = await this.repo.queryRecent(since, LIMITS.recentQueryLimit);
    const scored = recent.map((p) => ({ post: p, score: feedScore(p, now) }));

    // hot areas: group by ~5km geohash cell
    const areas = new Map<string, { posts: typeof scored }>();
    for (const s of scored) {
      const key = s.post.geohash.slice(0, 5);
      const a = areas.get(key) ?? { posts: [] };
      a.posts.push(s);
      areas.set(key, a);
    }
    const hotAreas = [...areas.entries()]
      .map(([geohash, { posts }]) => {
        posts.sort((a, b) => b.score - a.score);
        const top = posts[0]!.post;
        return {
          geohash,
          placeName: top.placeName,
          location: top.location,
          postCount: posts.length,
          verifiedCount: posts.filter((p) => p.post.verification?.status !== "unverified").length,
          heat: round(posts.reduce((n, p) => n + p.score, 0)),
          topPost: toPublicPost(top)
        };
      })
      .sort((a, b) => b.heat - a.heat)
      .slice(0, 10);

    const posts = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ post, score }) => ({ ...toPublicPost(post), feedScore: round(score) }));
    return { areas: hotAreas, posts };
  }

  async like(user: AuthUser, postId: string) {
    const post = await this.repo.get(postId);
    if (!post || post.status !== "published") throw new AppError(404, "게시물을 찾을 수 없습니다");
    const added = await this.repo.addLike(postId, user.userId);
    return { liked: true, alreadyLiked: !added, likeCount: post.likeCount + (added ? 1 : 0) };
  }

  async myPosts(user: AuthUser) {
    const posts = await this.repo.queryByUser(user.userId, 50);
    const published = posts.filter((p) => p.status === "published");
    const verified = published.filter((p) => p.verification?.status !== "unverified").length;
    return {
      posts: posts.map((p) => ({ ...toPublicPost(p), verificationDetail: p.verification })),
      stats: {
        total: published.length,
        verified,
        verifiedRatio: published.length ? round(verified / published.length) : 0
      }
    };
  }

  private async postsInBBox(bbox: BBox, since: Date) {
    const cells = geohashesCoveringBBox(bbox, GEO_INDEX_PRECISION, LIMITS.geoCellsMax);
    return cells
      ? this.repo.queryByGeohashes(cells, since, LIMITS.perCellQueryLimit)
      : this.repo.queryRecent(since, LIMITS.recentQueryLimit); // zoomed far out
  }

  private async enforceRateLimit(userId: string, now: Date) {
    const recent = await this.repo.queryByUser(userId, LIMITS.postsPer10Min);
    const cutoff = new Date(now.getTime() - 10 * 60_000).toISOString();
    if (recent.filter((p) => p.createdAt >= cutoff).length >= LIMITS.postsPer10Min) {
      throw new AppError(429, "잠시 후 다시 시도해주세요 (10분에 최대 10개)");
    }
  }
}

const round = (n: number) => Math.round(n * 1000) / 1000;
