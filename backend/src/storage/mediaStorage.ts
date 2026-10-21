export type UploadTarget = {
  /** HTML-form style POST target (S3 presigned POST or local dev server) */
  url: string;
  fields: Record<string, string>;
  maxBytes: number;
};

/**
 * Two areas:
 *  - "uploads": private originals with full EXIF, only the media processor reads them, deleted after processing
 *  - "public":  metadata-stripped copies served to everyone (CloudFront in AWS)
 */
export interface MediaStorage {
  createUpload(key: string, contentType: string, maxBytes: number): Promise<UploadTarget>;
  getUpload(key: string): Promise<Uint8Array>;
  deleteUpload(key: string): Promise<void>;
  putPublic(key: string, body: Uint8Array, contentType: string): Promise<void>;
  publicUrl(key: string): string;
}

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

export const uploadKeyFor = (postId: string) => `uploads/${postId}.jpg`;
export const publicKeyFor = (postId: string) => `p/${postId}.jpg`;
export const postIdFromUploadKey = (key: string) => key.match(/^uploads\/([A-Za-z0-9_-]+)\.jpg$/)?.[1] ?? null;
