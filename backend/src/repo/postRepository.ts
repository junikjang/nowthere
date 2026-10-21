import type { Post } from "../core/types.js";

/** Geohash precision used for the geo index (~39km x 20km cells) */
export const GEO_INDEX_PRECISION = 4;

/**
 * Storage port. The API only talks to this interface, so moving from DynamoDB to
 * PostgreSQL/PostGIS on EC2 later means writing one new adapter, not touching handlers.
 */
export interface PostRepository {
  create(post: Post): Promise<void>;
  save(post: Post): Promise<void>;
  get(id: string): Promise<Post | null>;
  getMany(ids: string[]): Promise<Post[]>;
  /** published posts in the given geohash cells (GEO_INDEX_PRECISION) created at/after `since` */
  queryByGeohashes(cells: string[], since: Date, limitPerCell: number): Promise<Post[]>;
  /** published posts anywhere created at/after `since`, newest first */
  queryRecent(since: Date, limit: number): Promise<Post[]>;
  queryByUser(userId: string, limit: number): Promise<Post[]>;
  /** returns false if this user already liked the post */
  addLike(postId: string, userId: string): Promise<boolean>;
}
