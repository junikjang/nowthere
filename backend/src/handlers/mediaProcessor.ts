import type { S3Event } from "aws-lambda";

import { DynamoPostRepository } from "../repo/dynamoPostRepository.js";
import { PostService } from "../services/postService.js";
import { postIdFromUploadKey } from "../storage/mediaStorage.js";
import { S3MediaStorage } from "../storage/s3MediaStorage.js";
import { env } from "./env.js";

const service = new PostService(
  new DynamoPostRepository(env("TABLE_NAME")),
  new S3MediaStorage(env("UPLOAD_BUCKET"), env("MEDIA_BUCKET"), env("MEDIA_BASE_URL"))
);

/**
 * Triggered by S3 ObjectCreated on the private upload bucket.
 * The S3 event time is the trusted "received at" timestamp used for real-time verification.
 */
export async function handler(event: S3Event) {
  for (const record of event.Records) {
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
    const postId = postIdFromUploadKey(key);
    if (!postId) {
      console.warn("ignoring unexpected key", key);
      continue;
    }
    const post = await service.processUpload(postId, new Date(record.eventTime));
    console.log(
      JSON.stringify({
        msg: "media processed",
        postId,
        status: post?.status,
        verification: post?.verification?.status,
        reasons: post?.verification?.reasons
      })
    );
  }
}
