import type { Post } from "../core/types.js";
import { GEO_INDEX_PRECISION, type PostRepository } from "./postRepository.js";

/** In-memory adapter for local development and tests */
export class MemoryPostRepository implements PostRepository {
  private posts = new Map<string, Post>();
  private likes = new Set<string>();

  async create(post: Post) {
    if (this.posts.has(post.id)) throw new Error("duplicate post id");
    this.posts.set(post.id, structuredClone(post));
  }
  async save(post: Post) {
    this.posts.set(post.id, structuredClone(post));
  }
  async get(id: string) {
    const p = this.posts.get(id);
    return p ? structuredClone(p) : null;
  }
  async getMany(ids: string[]) {
    return ids.map((id) => this.posts.get(id)).filter((p): p is Post => !!p).map((p) => structuredClone(p));
  }
  async queryByGeohashes(cells: string[], since: Date, limitPerCell: number) {
    const out: Post[] = [];
    for (const cell of cells) {
      out.push(
        ...this.published(since)
          .filter((p) => p.geohash.slice(0, GEO_INDEX_PRECISION) === cell)
          .slice(0, limitPerCell)
      );
    }
    return out;
  }
  async queryRecent(since: Date, limit: number) {
    return this.published(since).slice(0, limit);
  }
  async queryByUser(userId: string, limit: number) {
    return [...this.posts.values()]
      .filter((p) => p.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map((p) => structuredClone(p));
  }
  async addLike(postId: string, userId: string) {
    const key = `${postId}#${userId}`;
    const post = this.posts.get(postId);
    if (!post || this.likes.has(key)) return false;
    this.likes.add(key);
    post.likeCount += 1;
    return true;
  }

  private published(since: Date) {
    const s = since.toISOString();
    return [...this.posts.values()]
      .filter((p) => p.status === "published" && p.createdAt >= s)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((p) => structuredClone(p));
  }
}
