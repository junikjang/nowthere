import { config } from "../config";
import type { CreatePostInput, HotArea, MapPin, Post, UploadTarget } from "./types";

type TokenProvider = () => Promise<string | null>;
let tokenProvider: TokenProvider = async () => null;
export const setTokenProvider = (p: TokenProvider) => {
  tokenProvider = p;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit & { auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (init.auth) {
    const token = await tokenProvider();
    if (!token) throw new ApiError(401, "로그인이 필요합니다");
    headers.authorization = `Bearer ${token}`;
  }
  let res: Response;
  try {
    res = await fetch(`${config.apiUrl}${path}`, { ...init, headers: { ...headers, ...(init.headers as object) } });
  } catch {
    throw new ApiError(0, "서버에 연결할 수 없습니다");
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json.error ?? json.message ?? `요청 실패 (${res.status})`);
  return json as T;
}

export const api = {
  mapPins: (bbox: [number, number, number, number]) =>
    request<{ pins: MapPin[]; scanned: number; since: string }>(`/v1/map/pins?bbox=${bbox.map((n) => n.toFixed(5)).join(",")}`),

  nearby: (lat: number, lng: number, radiusM = 3000) =>
    request<{ posts: Post[] }>(`/v1/posts/nearby?lat=${lat}&lng=${lng}&radiusM=${radiusM}`),

  popular: () => request<{ areas: HotArea[]; posts: Post[] }>(`/v1/posts/popular`),

  posts: (ids: string[]) => request<{ posts: Post[] }>(`/v1/posts?ids=${ids.map(encodeURIComponent).join(",")}`),

  post: (id: string) => request<{ post: Post }>(`/v1/posts/${encodeURIComponent(id)}`),

  createPost: (input: CreatePostInput) =>
    request<{ post: Post; upload: UploadTarget | null }>(`/v1/posts`, {
      method: "POST",
      body: JSON.stringify(input),
      auth: true
    }),

  like: (id: string) =>
    request<{ likeCount: number; alreadyLiked: boolean }>(`/v1/posts/${encodeURIComponent(id)}/like`, {
      method: "POST",
      auth: true
    }),

  myPosts: () =>
    request<{ posts: Post[]; stats: { total: number; verified: number; verifiedRatio: number } }>(`/v1/me/posts`, {
      auth: true
    })
};

/** Upload the original JPEG straight to S3 (presigned POST) — it never passes through Lambda */
export async function uploadPhoto(target: UploadTarget, fileUri: string) {
  const form = new FormData();
  for (const [k, v] of Object.entries(target.fields)) form.append(k, v);
  // React Native's FormData accepts { uri, name, type } file descriptors; S3 requires the file to be last
  form.append("file", { uri: fileUri, name: "photo.jpg", type: "image/jpeg" } as unknown as Blob);
  const res = await fetch(target.url, { method: "POST", body: form });
  if (!res.ok && res.status !== 204) {
    const text = await res.text().catch(() => "");
    throw new ApiError(res.status, text.includes("EntityTooLarge") ? "사진 용량이 너무 큽니다" : "사진 업로드 실패");
  }
}

/** Media is verified asynchronously after upload; poll until the server decides */
export async function waitForPublished(id: string, timeoutMs = 20_000): Promise<Post> {
  const started = Date.now();
  for (;;) {
    const { post } = await api.post(id);
    if (post.status !== "pending_media" || Date.now() - started > timeoutMs) return post;
    await new Promise((r) => setTimeout(r, 1200));
  }
}
