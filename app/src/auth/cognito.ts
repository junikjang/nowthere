/**
 * Minimal Cognito User Pools client over plain fetch (no Amplify, no crypto polyfills).
 * Uses USER_PASSWORD_AUTH over HTTPS, which the CDK app client enables.
 */
import { config } from "../config";

export type Tokens = { idToken: string; refreshToken: string; expiresAt: number };

const ERRORS: Record<string, string> = {
  UsernameExistsException: "이미 가입된 이메일입니다",
  UserNotConfirmedException: "이메일 인증이 필요합니다",
  NotAuthorizedException: "이메일 또는 비밀번호가 올바르지 않습니다",
  UserNotFoundException: "이메일 또는 비밀번호가 올바르지 않습니다",
  CodeMismatchException: "인증 코드가 올바르지 않습니다",
  ExpiredCodeException: "인증 코드가 만료되었습니다. 다시 요청해주세요",
  InvalidPasswordException: "비밀번호는 8자 이상이어야 합니다",
  InvalidParameterException: "입력값을 확인해주세요",
  LimitExceededException: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요",
  TooManyRequestsException: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요"
};

export class CognitoError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
  }
}

async function call<T>(action: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://cognito-idp.${config.awsRegion}.amazonaws.com/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": `AWSCognitoIdentityProviderService.${action}`
    },
    body: JSON.stringify({ ClientId: config.cognitoClientId, ...body })
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = String(json.__type ?? "Unknown").split("#").pop()!;
    throw new CognitoError(code, ERRORS[code] ?? json.message ?? "인증 오류");
  }
  return json as T;
}

type AuthResult = { AuthenticationResult: { IdToken: string; RefreshToken?: string; ExpiresIn: number } };

export async function signUp(email: string, password: string, nickname: string) {
  await call("SignUp", {
    Username: email,
    Password: password,
    UserAttributes: [
      { Name: "email", Value: email },
      { Name: "nickname", Value: nickname }
    ]
  });
}

export async function confirmSignUp(email: string, code: string) {
  await call("ConfirmSignUp", { Username: email, ConfirmationCode: code.trim() });
}

export async function resendCode(email: string) {
  await call("ResendConfirmationCode", { Username: email });
}

export async function signIn(email: string, password: string): Promise<Tokens> {
  const r = await call<AuthResult>("InitiateAuth", {
    AuthFlow: "USER_PASSWORD_AUTH",
    AuthParameters: { USERNAME: email, PASSWORD: password }
  });
  return toTokens(r, null);
}

export async function refresh(refreshToken: string): Promise<Tokens> {
  const r = await call<AuthResult>("InitiateAuth", {
    AuthFlow: "REFRESH_TOKEN_AUTH",
    AuthParameters: { REFRESH_TOKEN: refreshToken }
  });
  return toTokens(r, refreshToken);
}

function toTokens(r: AuthResult, previousRefresh: string | null): Tokens {
  const a = r.AuthenticationResult;
  return {
    idToken: a.IdToken,
    refreshToken: a.RefreshToken ?? previousRefresh ?? "",
    expiresAt: Date.now() + (a.ExpiresIn - 60) * 1000
  };
}

/** Reads the nickname claim from an ID token (display only; the server verifies tokens) */
export function nicknameFromIdToken(idToken: string): string {
  try {
    let b64 = idToken.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const utf8 = Array.from(atob(b64), (c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`).join("");
    const json = JSON.parse(decodeURIComponent(utf8));
    return json.nickname ?? json.email ?? "사용자";
  } catch {
    return "사용자";
  }
}
