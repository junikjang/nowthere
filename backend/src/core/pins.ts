import { inBBox } from "./geo.js";
import { pinScore } from "./ranking.js";
import type { BBox, MapPin, Post } from "./types.js";

export const PIN_POLICY = {
  gridRows: 4,
  gridCols: 4,
  maxPinsPerCell: 3,
  /** candidates closer than this fraction of a cell's width/height are merged into one pin */
  mergeFraction: 0.3
} as const;

/**
 * Split the viewport into a 4x4 grid, keep at most 3 representative pins per cell,
 * merging nearby candidates. Because the merge distance is relative to the viewport,
 * zooming out naturally merges more and zooming in reveals more.
 */
export function aggregatePins(posts: Post[], bbox: BBox, now: Date): MapPin[] {
  const { gridRows, gridCols, maxPinsPerCell, mergeFraction } = PIN_POLICY;
  const cellW = (bbox.maxLng - bbox.minLng) / gridCols;
  const cellH = (bbox.maxLat - bbox.minLat) / gridRows;
  const mergeLng = cellW * mergeFraction;
  const mergeLat = cellH * mergeFraction;

  const cells = new Map<number, { post: Post; score: number }[]>();
  for (const post of posts) {
    if (post.status !== "published" || !inBBox(post.location, bbox)) continue;
    const col = Math.min(gridCols - 1, Math.floor((post.location.lng - bbox.minLng) / cellW));
    const row = Math.min(gridRows - 1, Math.floor((post.location.lat - bbox.minLat) / cellH));
    const key = row * gridCols + col;
    const list = cells.get(key) ?? [];
    list.push({ post, score: pinScore(post, now) });
    cells.set(key, list);
  }

  const pins: MapPin[] = [];
  for (const candidates of cells.values()) {
    candidates.sort((a, b) => b.score - a.score);
    const cellPins: MapPin[] = [];
    for (const { post, score } of candidates) {
      const near = cellPins.find(
        (p) => Math.abs(p.lat - post.location.lat) < mergeLat && Math.abs(p.lng - post.location.lng) < mergeLng
      );
      if (near) {
        near.count += 1;
        near.postIds.push(post.id);
        continue;
      }
      if (cellPins.length >= maxPinsPerCell) {
        // cell is full: fold into the closest existing pin so counts stay honest
        const closest = cellPins.reduce((best, p) =>
          dist2(p, post) < dist2(best, post) ? p : best
        );
        closest.count += 1;
        closest.postIds.push(post.id);
        continue;
      }
      cellPins.push({
        id: post.id,
        lat: post.location.lat,
        lng: post.location.lng,
        title: post.placeName,
        caption: post.caption,
        mediaUrl: post.mediaUrl,
        verification: post.verification?.status ?? "unverified",
        count: 1,
        postIds: [post.id],
        score: Math.round(score * 1000) / 1000,
        createdAt: post.createdAt
      });
    }
    pins.push(...cellPins);
  }
  return pins.sort((a, b) => b.score - a.score);
}

function dist2(p: MapPin, post: Post) {
  return (p.lat - post.location.lat) ** 2 + (p.lng - post.location.lng) ** 2;
}
