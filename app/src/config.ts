/**
 * Values come from app/.env (written automatically by `npm run deploy` in /infra).
 * With no Cognito client id the app runs in local-dev mode against `backend` (npm run dev).
 */
export const config = {
  apiUrl: (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, ""),
  awsRegion: process.env.EXPO_PUBLIC_AWS_REGION ?? "ap-northeast-2",
  cognitoClientId: process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID ?? ""
};

export const isDevAuth = config.cognitoClientId.length === 0;
