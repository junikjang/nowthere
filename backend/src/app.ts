import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";

import { parseBBox } from "./core/geo.js";
import { PIN_POLICY } from "./core/pins.js";
import { VERIFICATION_RULES } from "./core/verification.js";
import { AppError, LIMITS, type AuthUser, type PostService } from "./services/postService.js";

/** How the current request's user is resolved differs per runtime (API Gateway authorizer vs JWT verify on EC2) */
export type AuthResolver = (c: Context) => Promise<AuthUser | null>;

const latLng = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

const createPostSchema = z.object({
  mediaType: z.enum(["text", "image"]),
  caption: z.string().max(500).default(""),
  tags: z.array(z.string().max(20)).max(5).default([]),
  placeName: z.string().trim().min(1).max(60),
  location: latLng,
  device: latLng.extend({ accuracyM: z.number().min(0).max(100_000).nullish() }).nullable(),
  clientCapturedAt: z.string().datetime({ offset: true }).nullish(),
  clientUtcOffsetMinutes: z.number().int().min(-840).max(840).nullish()
});

export function createApp(service: PostService, resolveUser: AuthResolver) {
  const app = new Hono();

  app.use("*", cors());

  app.onError((err, c) => {
    if (err instanceof AppError) return c.json({ error: err.message }, err.status);
    if (err instanceof z.ZodError) return c.json({ error: "잘못된 요청", details: err.flatten() }, 400);
    console.error(err);
    return c.json({ error: "서버 오류" }, 500);
  });

  const requireUser = async (c: Context) => {
    const user = await resolveUser(c);
    if (!user) throw new AppError(401, "로그인이 필요합니다");
    return user;
  };

  app.get("/health", (c) => c.json({ status: "ok", locale: "ko-KR", time: new Date().toISOString() }));

  app.get("/v1/config", (c) =>
    c.json({
      defaultLocale: "ko-KR",
      realtimeWindowHours: LIMITS.realtimeWindowHours,
      mapPinPolicy: PIN_POLICY,
      verificationRules: VERIFICATION_RULES
    })
  );

  app.get("/v1/map/pins", async (c) => {
    const bbox = parseBBox(c.req.query("bbox"));
    if (!bbox) throw new AppError(400, "bbox=minLng,minLat,maxLng,maxLat 형식이 필요합니다");
    const hours = Math.min(72, Math.max(1, Number(c.req.query("windowHours") ?? LIMITS.realtimeWindowHours)));
    return c.json(await service.mapPins(bbox, hours));
  });

  app.get("/v1/posts/nearby", async (c) => {
    const lat = Number(c.req.query("lat"));
    const lng = Number(c.req.query("lng"));
    const radiusM = Math.min(20_000, Math.max(100, Number(c.req.query("radiusM") ?? 3000)));
    const parsed = latLng.safeParse({ lat, lng });
    if (!parsed.success) throw new AppError(400, "lat, lng가 필요합니다");
    return c.json({ posts: await service.nearby(parsed.data, radiusM) });
  });

  app.get("/v1/posts/popular", async (c) => {
    const limit = Math.min(50, Math.max(1, Number(c.req.query("limit") ?? 20)));
    return c.json(await service.popular(limit));
  });

  app.get("/v1/posts", async (c) => {
    const ids = (c.req.query("ids") ?? "").split(",").filter(Boolean).slice(0, 50);
    return c.json({ posts: await service.getPosts(ids) });
  });

  app.get("/v1/posts/:id", async (c) => c.json({ post: await service.getPost(c.req.param("id")) }));

  app.post("/v1/posts", async (c) => {
    const user = await requireUser(c);
    const input = createPostSchema.parse(await c.req.json());
    if (input.mediaType === "text" && input.caption.trim().length === 0) {
      throw new AppError(400, "텍스트 게시물은 내용이 필요합니다");
    }
    return c.json(await service.createPost(user, input), 201);
  });

  app.post("/v1/posts/:id/like", async (c) => {
    const user = await requireUser(c);
    return c.json(await service.like(user, c.req.param("id")));
  });

  app.get("/v1/me/posts", async (c) => {
    const user = await requireUser(c);
    return c.json(await service.myPosts(user));
  });

  return app;
}
