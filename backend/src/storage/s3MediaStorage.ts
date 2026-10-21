import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";

import type { MediaStorage, UploadTarget } from "./mediaStorage.js";

export class S3MediaStorage implements MediaStorage {
  constructor(
    private uploadBucket: string,
    private mediaBucket: string,
    private mediaBaseUrl: string,
    private s3 = new S3Client({})
  ) {}

  async createUpload(key: string, contentType: string, maxBytes: number): Promise<UploadTarget> {
    // Presigned POST (not PUT) so S3 itself enforces the size limit
    const { url, fields } = await createPresignedPost(this.s3, {
      Bucket: this.uploadBucket,
      Key: key,
      Conditions: [
        ["content-length-range", 1, maxBytes],
        ["eq", "$Content-Type", contentType]
      ],
      Fields: { "Content-Type": contentType },
      Expires: 300
    });
    return { url, fields, maxBytes };
  }

  async getUpload(key: string) {
    const res = await this.s3.send(new GetObjectCommand({ Bucket: this.uploadBucket, Key: key }));
    if (!res.Body) throw new Error(`empty object ${key}`);
    return res.Body.transformToByteArray();
  }

  async deleteUpload(key: string) {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.uploadBucket, Key: key }));
  }

  async putPublic(key: string, body: Uint8Array, contentType: string) {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.mediaBucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable"
      })
    );
  }

  publicUrl(key: string) {
    return `${this.mediaBaseUrl.replace(/\/$/, "")}/${key}`;
  }
}
