import { readFileSync } from "node:fs";

import exifr from "exifr";
import { describe, expect, it } from "vitest";

import { encodeGeohash, geohashesCoveringBBox, haversineM, parseBBox } from "../src/core/geo.js";
import { extractExif, parseExifDate, stripJpegMetadata } from "../src/core/media.js";
import { aggregatePins } from "../src/core/pins.js";
import type { Post } from "../src/core/types.js";
import { verify } from "../src/core/verification.js";

const GANGNAM = { lat: 37.4979, lng: 127.0276 };

describe("geo", () => {
  it("encodes geohash like the reference implementation", () => {
    expect(encodeGeohash(57.64911, 10.40744, 11)).toBe("u4pruydqqvj");
    expect(encodeGeohash(GANGNAM.lat, GANGNAM.lng, 4)).toBe("wydm"); // Seoul
  });

  it("covers a bbox with geohash cells and refuses huge areas", () => {
    const seoul = { minLng: 126.8, minLat: 37.4, maxLng: 127.2, maxLat: 37.7 };
    const cells = geohashesCoveringBBox(seoul, 4, 24)!;
    expect(cells.length).toBeGreaterThan(0);
    expect(cells).toContain(encodeGeohash(GANGNAM.lat, GANGNAM.lng, 4));
    expect(geohashesCoveringBBox({ minLng: 120, minLat: 30, maxLng: 135, maxLat: 45 }, 4, 24)).toBeNull();
  });

  it("measures distance", () => {
    const seoulStation = { lat: 37.5547, lng: 126.9706 };
    expect(Math.round(haversineM(GANGNAM, seoulStation) / 100) / 10).toBeCloseTo(8.2, 0);
  });

  it("parses bbox", () => {
    expect(parseBBox("126.9,37.4,127.1,37.6")).toEqual({ minLng: 126.9, minLat: 37.4, maxLng: 127.1, maxLat: 37.6 });
    expect(parseBBox("1,2,3")).toBeNull();
    expect(parseBBox("127,37,126,38")).toBeNull();
  });
});

describe("verification", () => {
  const receivedAt = new Date("2026-10-21T12:00:00Z");
  const base = {
    claimed: GANGNAM,
    device: { lat: 37.4985, lng: 127.028 }, // ~75m away
    deviceAccuracyM: 15,
    receivedAt,
    captureTimeSource: "file_exif" as const,
    exifGps: null
  };

  it("fresh + close = verified_now", () => {
    const v = verify({ ...base, capturedAt: new Date("2026-10-21T11:55:00Z") });
    expect(v.status).toBe("verified_now");
    expect(v.reasons).toEqual([]);
  });

  it("30 minutes old = verified_nearby", () => {
    expect(verify({ ...base, capturedAt: new Date("2026-10-21T11:30:00Z") }).status).toBe("verified_nearby");
  });

  it("2 hours old = unverified", () => {
    expect(verify({ ...base, capturedAt: new Date("2026-10-21T10:00:00Z") }).status).toBe("unverified");
  });

  it("device 1km away = nearby, 5km away = unverified", () => {
    const t = new Date("2026-10-21T11:58:00Z");
    expect(verify({ ...base, capturedAt: t, device: { lat: 37.507, lng: 127.0276 } }).status).toBe("verified_nearby");
    expect(verify({ ...base, capturedAt: t, device: { lat: 37.543, lng: 127.0276 } }).status).toBe("unverified");
  });

  it("capture time in the future = unverified (clock tampering)", () => {
    const v = verify({ ...base, capturedAt: new Date("2026-10-21T12:30:00Z") });
    expect(v.status).toBe("unverified");
  });

  it("client-reported EXIF caps at verified_nearby", () => {
    const v = verify({ ...base, capturedAt: new Date("2026-10-21T11:59:00Z"), captureTimeSource: "client_exif" });
    expect(v.status).toBe("verified_nearby");
  });

  it("EXIF GPS far from the place = unverified even if device is close", () => {
    const v = verify({
      ...base,
      capturedAt: new Date("2026-10-21T11:59:00Z"),
      exifGps: { lat: 35.1587, lng: 129.1604 } // Busan
    });
    expect(v.status).toBe("unverified");
  });

  it("no device location = unverified", () => {
    expect(verify({ ...base, capturedAt: receivedAt, device: null }).status).toBe("unverified");
  });
});

describe("media", () => {
  const withExif = new Uint8Array(readFileSync(new URL("./fixtures/gangnam_exif.jpg", import.meta.url)));
  const noExif = new Uint8Array(readFileSync(new URL("./fixtures/no_exif.jpg", import.meta.url)));

  it("parses EXIF time with and without offsets", () => {
    expect(parseExifDate("2026:10:21 20:50:00", "+09:00", null)?.toISOString()).toBe("2026-10-21T11:50:00.000Z");
    expect(parseExifDate("2026:10:21 20:50:00", undefined, 540)?.toISOString()).toBe("2026-10-21T11:50:00.000Z");
    expect(parseExifDate("2026:10:21 20:50:00", undefined, null)?.toISOString()).toBe("2026-10-21T20:50:00.000Z");
    expect(parseExifDate("garbage", undefined, null)).toBeNull();
  });

  it("extracts capture time, GPS and orientation from a real JPEG", async () => {
    const exif = await extractExif(withExif, null);
    expect(exif.capturedAt?.toISOString()).toBe("2026-10-21T11:50:00.000Z");
    expect(exif.gps!.lat).toBeCloseTo(37.4979, 4);
    expect(exif.gps!.lng).toBeCloseTo(127.0276, 4);
    expect(exif.orientation).toBe(6);
  });

  it("handles photos without EXIF", async () => {
    const exif = await extractExif(noExif, 540);
    expect(exif.capturedAt).toBeNull();
    expect(exif.gps).toBeNull();
  });

  it("strips GPS/time but keeps orientation, and the image stays decodable", async () => {
    const stripped = stripJpegMetadata(withExif, 6);
    expect(stripped.length).toBeLessThan(withExif.length);
    const after = await exifr.parse(stripped, { gps: true, exif: true, tiff: true, translateValues: false });
    expect(after?.Orientation).toBe(6);
    expect(after?.latitude).toBeUndefined();
    expect(after?.DateTimeOriginal).toBeUndefined();
    expect(Buffer.from(stripped).includes(Buffer.from("secret comment"))).toBe(false);
    expect(Buffer.from(stripped).includes(Buffer.from("TestCam"))).toBe(false);
    // ends with EOI
    expect([stripped.at(-2), stripped.at(-1)]).toEqual([0xff, 0xd9]);
  });
});

describe("pins", () => {
  const now = new Date("2026-10-21T12:00:00Z");
  const mk = (id: string, lat: number, lng: number, minutesAgo = 5, status: Post["status"] = "published"): Post => ({
    id,
    userId: "u",
    nickname: "n",
    mediaType: "text",
    caption: id,
    tags: [],
    placeName: id,
    location: { lat, lng },
    geohash: encodeGeohash(lat, lng, 7),
    claimedLocation: { lat, lng },
    deviceLocation: null,
    deviceAccuracyM: null,
    clientCapturedAt: null,
    clientUtcOffsetMinutes: null,
    mediaKey: null,
    mediaUrl: null,
    status,
    verification: null,
    likeCount: 0,
    createdAt: new Date(now.getTime() - minutesAgo * 60_000).toISOString(),
    publishedAt: null
  });
  const bbox = { minLng: 0, minLat: 0, maxLng: 4, maxLat: 4 }; // each cell is 1x1 degree

  it("caps at 3 pins per cell and keeps counts", () => {
    const posts = [0.1, 0.4, 0.7, 0.95].map((x, i) => mk(`p${i}`, 0.5, x));
    posts.push(mk("p4", 0.5, 0.92)); // close to p3 -> merged
    const pins = aggregatePins(posts, bbox, now);
    expect(pins.length).toBe(3);
    expect(pins.reduce((n, p) => n + p.count, 0)).toBe(5);
  });

  it("merges more when zoomed out", () => {
    const posts = [mk("a", 1.1, 1.1), mk("b", 1.1, 1.8), mk("c", 1.8, 1.1)];
    expect(aggregatePins(posts, bbox, now).length).toBe(3);
    expect(aggregatePins(posts, { minLng: 0, minLat: 0, maxLng: 40, maxLat: 40 }, now).length).toBe(1);
  });

  it("ignores unpublished posts and posts outside the viewport", () => {
    const pins = aggregatePins([mk("x", 10, 10), mk("y", 1, 1, 5, "pending_media")], bbox, now);
    expect(pins).toEqual([]);
  });

  it("ranks fresher posts first", () => {
    const pins = aggregatePins([mk("old", 0.5, 0.5, 600), mk("new", 3.5, 3.5, 1)], bbox, now);
    expect(pins[0]!.id).toBe("new");
  });
});
