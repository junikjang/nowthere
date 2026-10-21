/**
 * Plain Node server entry point.
 *  - Local dev (default): in-memory DB, media on disk, "dev:<nickname>" tokens, sample data. No AWS needed.
 *  - EC2 later: set TABLE_NAME / UPLOAD_BUCKET / MEDIA_BUCKET / MEDIA_BASE_URL / COGNITO_* and the same
 *    API runs against the same DynamoDB, S3 and Cognito as the Lambda version.
 */
import { randomUUID } from "node:crypto";

import { serve } from "@hono/node-server";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { Hono } from "hono";

import { createApp, type AuthResolver } from "./app.js";
import { encodeGeohash } from "./core/geo.js";
import type { Post } from "./core/types.js";
import { DynamoPostRepository } from "./repo/dynamoPostRepository.js";
import { MemoryPostRepository } from "./repo/memoryPostRepository.js";
import type { PostRepository } from "./repo/postRepository.js";
import { PostService } from "./services/postService.js";
import { LocalMediaStorage } from "./storage/localMediaStorage.js";
import { MAX_UPLOAD_BYTES, postIdFromUploadKey, type MediaStorage } from "./storage/mediaStorage.js";
import { S3MediaStorage } from "./storage/s3MediaStorage.js";

const port = Number(process.env.PORT ?? 4000);
const publicBaseUrl = process.env.PUBLIC_BASE_URL ?? `http://localhost:${port}`;

const repo: PostRepository = process.env.TABLE_NAME
  ? new DynamoPostRepository(process.env.TABLE_NAME)
  : new MemoryPostRepository();

const localStorage = new LocalMediaStorage(process.env.LOCAL_MEDIA_DIR ?? ".local-media", publicBaseUrl);
const storage: MediaStorage = process.env.UPLOAD_BUCKET
  ? new S3MediaStorage(process.env.UPLOAD_BUCKET, process.env.MEDIA_BUCKET!, process.env.MEDIA_BASE_URL!)
  : localStorage;

const service = new PostService(repo, storage);

let resolveUser: AuthResolver;
if (process.env.COGNITO_USER_POOL_ID && process.env.COGNITO_CLIENT_ID) {
  const verifier = CognitoJwtVerifier.create({
    userPoolId: process.env.COGNITO_USER_POOL_ID,
    clientId: process.env.COGNITO_CLIENT_ID,
    tokenUse: "id"
  });
  resolveUser = async (c) => {
    const token = c.req.header("authorization")?.replace(/^Bearer /i, "");
    if (!token) return null;
    try {
      const claims = await verifier.verify(token);
      return { userId: claims.sub, nickname: String(claims.nickname ?? claims["cognito:username"] ?? "익명") };
    } catch {
      return null;
    }
  };
} else {
  // DEV ONLY: "Authorization: Bearer dev:<url-encoded nickname>"
  resolveUser = async (c) => {
    const m = c.req.header("authorization")?.match(/^Bearer dev:([^\s]{1,120})$/i);
    if (!m) return null;
    const nickname = decodeURIComponent(m[1]!).slice(0, 30);
    return { userId: `dev-${nickname}`, nickname };
  };
  console.warn("[auth] DEV mode: tokens are 'dev:<nickname>'. Never expose this server publicly.");
}

const app = new Hono();

if (storage === localStorage) {
  // Mimics an S3 presigned POST so the app uses the exact same upload code locally
  app.post("/local-upload", async (c) => {
    const form = await c.req.formData();
    const key = String(form.get("key") ?? "");
    const file = form.get("file");
    const postId = postIdFromUploadKey(key);
    if (!postId || !(file instanceof File)) return c.json({ error: "bad upload" }, 400);
    if (file.size > MAX_UPLOAD_BYTES) return c.json({ error: "too large" }, 413);
    await localStorage.saveUpload(key, new Uint8Array(await file.arrayBuffer()));
    const post = await service.processUpload(postId, new Date());
    return c.body(null, post ? 204 : 404);
  });

  app.get("/media/:key{.+}", async (c) => {
    try {
      const body = await localStorage.readPublic(c.req.param("key"));
      return c.body(body, 200, { "content-type": "image/jpeg" });
    } catch {
      return c.notFound();
    }
  });
}

app.route("/", createApp(service, resolveUser));

if (repo instanceof MemoryPostRepository && process.env.SEED !== "0") {
  await seed(repo);
}

serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, () => {
  console.log(`NowThere API on ${publicBaseUrl} (db=${process.env.TABLE_NAME ? "dynamodb" : "memory"})`);
});

async function seed(r: MemoryPostRepository) {
  const now = Date.now();
  const samples: [string, number, number, string, number, "verified_now" | "verified_nearby" | "unverified"][] = [
    ["강남역", 37.4979, 127.0276, "퇴근길 인파 많음, 2번 출구 혼잡", 6, "verified_now"],
    ["서울역", 37.5547, 126.9706, "KTX 대합실 한산한 편", 18, "verified_now"],
    ["홍대입구역", 37.5572, 126.9245, "버스킹 시작, 사람 몰리는 중", 25, "verified_nearby"],
    ["여의도 한강공원", 37.5284, 126.9327, "바람 강하게 붐, 돗자리 날아감", 40, "verified_nearby"],
    ["광화문", 37.5759, 126.9768, "집회로 세종대로 일부 통제", 12, "verified_now"],
    ["잠실 롯데월드몰", 37.5126, 127.1025, "주차장 만차", 70, "unverified"],
    ["성수동 카페거리", 37.5446, 127.0559, "팝업스토어 대기줄 1시간", 9, "verified_now"],
    ["부산 해운대", 35.1587, 129.1604, "파도 높음, 입수 통제 중", 15, "verified_now"]
  ];
  for (const [placeName, lat, lng, caption, minutesAgo, status] of samples) {
    const createdAt = new Date(now - minutesAgo * 60_000).toISOString();
    const post: Post = {
      id: randomUUID(),
      userId: "seed",
      nickname: "샘플",
      mediaType: "text",
      caption,
      tags: [],
      placeName,
      location: { lat, lng },
      geohash: encodeGeohash(lat, lng, 7),
      claimedLocation: { lat, lng },
      deviceLocation: { lat, lng },
      deviceAccuracyM: 10,
      clientCapturedAt: null,
      clientUtcOffsetMinutes: 540,
      mediaKey: null,
      mediaUrl: null,
      status: "published",
      verification: {
        status,
        score: status === "verified_now" ? 1 : status === "verified_nearby" ? 0.6 : 0.1,
        capturedAt: createdAt,
        captureTimeSource: "server_receive",
        receivedAt: createdAt,
        captureAgeMinutes: 0,
        deviceDistanceM: 0,
        exifGpsDistanceM: null,
        reasons: []
      },
      likeCount: Math.floor(Math.random() * 20),
      createdAt,
      publishedAt: createdAt
    };
    await r.create(post);
  }
  console.log(`[seed] ${samples.length} sample posts`);
}
