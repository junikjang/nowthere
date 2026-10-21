# Same API as the Lambda version, as a long-running container (EC2 / ECS / Lightsail).
# Configure with env: TABLE_NAME, UPLOAD_BUCKET, MEDIA_BUCKET, MEDIA_BASE_URL,
# COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID, AWS_REGION. See docs/aws-architecture.md §6.
FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
ENV NODE_ENV=production PORT=4000 SEED=0
EXPOSE 4000
CMD ["npx", "tsx", "src/local.ts"]
