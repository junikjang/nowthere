import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { handle } from "hono/aws-lambda";

import { createApp } from "../app.js";
import { DynamoPostRepository } from "../repo/dynamoPostRepository.js";
import { PostService } from "../services/postService.js";
import { S3MediaStorage } from "../storage/s3MediaStorage.js";
import { env } from "./env.js";

const service = new PostService(
  new DynamoPostRepository(env("TABLE_NAME")),
  new S3MediaStorage(env("UPLOAD_BUCKET"), env("MEDIA_BUCKET"), env("MEDIA_BASE_URL"))
);

/**
 * API Gateway's JWT authorizer has already verified the Cognito token on protected routes,
 * so we just read the claims it attached to the event.
 */
const app = createApp(service, async (c) => {
  const event = (c.env as { event?: APIGatewayProxyEventV2WithJWTAuthorizer } | undefined)?.event;
  const claims = event?.requestContext?.authorizer?.jwt?.claims;
  if (!claims?.sub) return null;
  const nickname = String(claims.nickname ?? claims["cognito:username"] ?? "익명").slice(0, 30);
  return { userId: String(claims.sub), nickname };
});

export const handler = handle(app);
