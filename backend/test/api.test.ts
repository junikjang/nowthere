import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { MemoryPostRepository } from "../src/repo/memoryPostRepository.js";
import { PostService } from "../src/services/postService.js";
import { LocalMediaStorage } from "../src/storage/localMediaStorage.js";

const GANGNAM = { lat: 37.4979, lng: 127.0276 };
const NOW = new Date("2026-10-21T11:55:00Z"); // 5 minutes after the fixture photo was taken

function setup() {
  const repo = new MemoryPostRepository();
  const storage = new LocalMediaStorage(mkdtempSync(join(tmpdir(), "nt-")), "http://test");
  const service = new PostService(repo, storage, () => NOW);
  const app = createApp(service, async (c) => {
    const m = c.req.header("authorization")?.match(/^Bearer dev:(.+)$/);
    return m ? { userId: `u-${m[1]}`, nickname: decodeURIComponent(m[1]!) } : null;
  });
  const call = (method: string, path: string, body?: unknown, user = "준익") =>
    app.request(path, {
      method,
      headers: { "content-type": "application/json", ...(user ? { authorization: `Bearer dev:${encodeURIComponent(user)}` } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
  return { repo, storage, service, call };
}

describe("API", () => {
  let t: ReturnType<typeof setup>;
  beforeEach(() => {
    t = setup();
  });

  it("requires login to post", async () => {
    const res = await t.call("POST", "/v1/posts", {}, "");
    expect(res.status).toBe(401);
  });

  it("validates input", async () => {
    const res = await t.call("POST", "/v1/posts", { mediaType: "text", placeName: "", location: GANGNAM, device: null });
    expect(res.status).toBe(400);
  });

  it("text post near the place is published as verified_now and never leaks private fields", async () => {
    const res = await t.call("POST", "/v1/posts", {
      mediaType: "text",
      caption: "2번 출구 혼잡",
      placeName: "강남역",
      location: GANGNAM,
      device: { lat: 37.4981, lng: 127.0279, accuracyM: 12 }
    });
    expect(res.status).toBe(201);
    const { post, upload } = (await res.json()) as any;
    expect(upload).toBeNull();
    expect(post.status).toBe("published");
    expect(post.verification.status).toBe("verified_now");
    expect(post.deviceLocation).toBeUndefined();
    expect(post.claimedLocation).toBeUndefined();

    const pins = (await (await t.call("GET", "/v1/map/pins?bbox=126.9,37.4,127.1,37.6")).json()) as any;
    expect(pins.pins).toHaveLength(1);
    expect(pins.pins[0].title).toBe("강남역");
  });

  it("image post: pending until upload is processed, then verified from file EXIF", async () => {
    const res = await t.call("POST", "/v1/posts", {
      mediaType: "image",
      caption: "비 오기 시작",
      placeName: "강남역",
      location: GANGNAM,
      device: { lat: 37.4981, lng: 127.0279, accuracyM: 12 },
      clientUtcOffsetMinutes: 540
    });
    const { post, upload } = (await res.json()) as any;
    expect(post.status).toBe("pending_media");
    expect(upload.fields.key).toBe(`uploads/${post.id}.jpg`);

    // not on the map yet
    let pins = (await (await t.call("GET", "/v1/map/pins?bbox=126.9,37.4,127.1,37.6")).json()) as any;
    expect(pins.pins).toHaveLength(0);

    const jpg = new Uint8Array(readFileSync(new URL("./fixtures/gangnam_exif.jpg", import.meta.url)));
    await t.storage.saveUpload(upload.fields.key, jpg);
    const processed = await t.service.processUpload(post.id, NOW);

    expect(processed!.status).toBe("published");
    expect(processed!.verification!.status).toBe("verified_now");
    expect(processed!.verification!.captureTimeSource).toBe("file_exif");
    expect(processed!.verification!.captureAgeMinutes).toBe(5);
    expect(processed!.verification!.exifGpsDistanceM).toBeLessThan(50);
    expect(processed!.mediaUrl).toBe(`http://test/media/p/${post.id}.jpg`);
    await expect(t.storage.getUpload(upload.fields.key)).rejects.toThrow(); // original deleted

    pins = (await (await t.call("GET", "/v1/map/pins?bbox=126.9,37.4,127.1,37.6")).json()) as any;
    expect(pins.pins).toHaveLength(1);
    expect(pins.pins[0].mediaUrl).toContain(post.id);
  });

  it("old photo is downgraded", async () => {
    const late = new PostService(t.repo, t.storage, () => new Date("2026-10-21T13:00:00Z"));
    const { post, upload } = await late.createPost(
      { userId: "u", nickname: "n" },
      { mediaType: "image", caption: "", tags: [], placeName: "강남역", location: GANGNAM, device: GANGNAM }
    );
    await t.storage.saveUpload(upload!.fields.key!, new Uint8Array(readFileSync(new URL("./fixtures/gangnam_exif.jpg", import.meta.url))));
    const processed = await late.processUpload(post.id, new Date("2026-10-21T13:00:00Z"));
    expect(processed!.verification!.status).toBe("unverified");
  });

  it("nearby, popular, likes, my posts", async () => {
    for (const [name, lat, lng] of [
      ["강남역", 37.4979, 127.0276],
      ["역삼역", 37.5006, 127.0364],
      ["해운대", 35.1587, 129.1604]
    ] as const) {
      await t.call("POST", "/v1/posts", {
        mediaType: "text",
        caption: `${name} 지금`,
        placeName: name,
        location: { lat, lng },
        device: { lat, lng }
      });
    }
    const nearby = (await (await t.call("GET", `/v1/posts/nearby?lat=${GANGNAM.lat}&lng=${GANGNAM.lng}&radiusM=2000`)).json()) as any;
    expect(nearby.posts.map((p: any) => p.placeName).sort()).toEqual(["강남역", "역삼역"]);
    expect(nearby.posts[0].distanceM).toBeTypeOf("number");

    const popular = (await (await t.call("GET", "/v1/posts/popular")).json()) as any;
    expect(popular.posts).toHaveLength(3);
    expect(popular.areas.length).toBeGreaterThanOrEqual(2);

    const id = nearby.posts[0].id;
    const like1 = (await (await t.call("POST", `/v1/posts/${id}/like`, {}, "a")).json()) as any;
    const like2 = (await (await t.call("POST", `/v1/posts/${id}/like`, {}, "a")).json()) as any;
    expect(like1.likeCount).toBe(1);
    expect(like2.alreadyLiked).toBe(true);
    expect(like2.likeCount).toBe(1);

    const mine = (await (await t.call("GET", "/v1/me/posts")).json()) as any;
    expect(mine.stats.total).toBe(3);
    expect(mine.stats.verifiedRatio).toBe(1);
  });

  it("rate limits bursts", async () => {
    const body = { mediaType: "text", caption: "x", placeName: "p", location: GANGNAM, device: GANGNAM };
    for (let i = 0; i < 10; i++) expect((await t.call("POST", "/v1/posts", body)).status).toBe(201);
    expect((await t.call("POST", "/v1/posts", body)).status).toBe(429);
  });
});
