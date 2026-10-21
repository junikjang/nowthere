import type { Post } from "./types.js";

/** Minutes after which recency score falls to ~37% (e^-1). Real-time app: decay fast. */
const RECENCY_TAU_MINUTES = 90;

export function recencyScore(createdAt: string, now: Date): number {
  const ageMin = Math.max(0, (now.getTime() - new Date(createdAt).getTime()) / 60_000);
  return Math.exp(-ageMin / RECENCY_TAU_MINUTES);
}

export function engagementScore(likeCount: number): number {
  return 1 - Math.exp(-likeCount / 10);
}

/** feed_score = verification*0.45 + recency*0.35 + engagement*0.20  (docs/mvp-blueprint.md §7) */
export function feedScore(post: Post, now: Date): number {
  const v = post.verification?.score ?? 0;
  return v * 0.45 + recencyScore(post.createdAt, now) * 0.35 + engagementScore(post.likeCount) * 0.2;
}

/** pin_score = has_media*0.20 + verification*0.40 + recency*0.25 + engagement*0.15 */
export function pinScore(post: Post, now: Date): number {
  const v = post.verification?.score ?? 0;
  const hasMedia = post.mediaUrl ? 1 : 0;
  return (
    hasMedia * 0.2 + v * 0.4 + recencyScore(post.createdAt, now) * 0.25 + engagementScore(post.likeCount) * 0.15
  );
}
