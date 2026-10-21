import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import type { MediaStorage, UploadTarget } from "./mediaStorage.js";

/** Disk-backed storage for local development (and a starting point for a single EC2 box) */
export class LocalMediaStorage implements MediaStorage {
  constructor(
    private rootDir: string,
    private publicBaseUrl: string
  ) {}

  async createUpload(key: string, contentType: string, maxBytes: number): Promise<UploadTarget> {
    return {
      url: `${this.publicBaseUrl}/local-upload`,
      fields: { key, "Content-Type": contentType },
      maxBytes
    };
  }

  async getUpload(key: string) {
    return new Uint8Array(await readFile(this.path("private", key)));
  }

  async deleteUpload(key: string) {
    await rm(this.path("private", key), { force: true });
  }

  async saveUpload(key: string, body: Uint8Array) {
    const p = this.path("private", key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, body);
  }

  async putPublic(key: string, body: Uint8Array) {
    const p = this.path("public", key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, body);
  }

  async readPublic(key: string) {
    return new Uint8Array(await readFile(this.path("public", key)));
  }

  publicUrl(key: string) {
    return `${this.publicBaseUrl}/media/${key}`;
  }

  private path(area: "private" | "public", key: string) {
    const base = resolve(this.rootDir, area);
    const full = resolve(join(base, key));
    if (!full.startsWith(base)) throw new Error("invalid key");
    return full;
  }
}
