import { apiError } from "@repo/contracts/errors";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { ingestEventSchema } from "@repo/contracts/events";
import { createRateLimiter, type RateLimiter } from "./rate-limit";
import type { createIngestService } from "./services";

// Reads the site API key from Authorization: Bearer <key> or X-Api-Key.
function readApiKey(header: string | undefined, bearer: string | undefined): string | null {
  if (header) return header.trim();
  if (bearer?.startsWith("Bearer ")) return bearer.slice("Bearer ".length).trim();
  return null;
}

export function createIngestRouter(
  service: ReturnType<typeof createIngestService>,
  // Redis-backed limiter in production; the in-memory fallback for tests.
  limiter: RateLimiter = createRateLimiter({ limit: 120, windowMs: 60_000 }),
) {
  return new Hono()
    .post(
      "/v1/event",
      zValidator("json", ingestEventSchema, (result, c) => {
        if (!result.success) return c.json(apiError("validation_error"), 400);
      }),
      async (c) => {
        const apiKey = readApiKey(c.req.header("x-api-key"), c.req.header("authorization"));
        if (!apiKey) return c.json(apiError("unauthorized"), 401);
        const siteId = await service.resolveSiteByApiKey(apiKey);
        if (!siteId) return c.json(apiError("unauthorized"), 401);
        if (!(await limiter(`event:${siteId}`))) return c.json(apiError("rate_limited"), 429);
        const result = await service.ingestEvent(siteId, c.req.valid("json"));
        if (result === "duplicate") return c.json(apiError("conflict"), 409);
        return c.json({ ok: true }, 201);
      },
    )
    .post("/v1/webhook/:provider", async (c) => {
      const siteKey = c.req.query("site");
      if (!siteKey) return c.json(apiError("validation_error"), 400);
      if (!(await limiter(`webhook:${siteKey}`))) return c.json(apiError("rate_limited"), 429);
      const rawBody = await c.req.text();
      const result = await service.processWebhook({
        siteKey,
        provider: c.req.param("provider"),
        rawBody,
        headers: c.req.header(), // all request headers (lowercased keys)
      });
      switch (result) {
        case "created":
        case "filtered":
          return c.body(null, 202);
        case "duplicate":
          return c.json(apiError("conflict"), 409);
        case "not_found":
          return c.json(apiError("site_not_found"), 404);
        case "no_connector":
          return c.json(apiError("validation_error"), 400);
        case "invalid":
          return c.json(apiError("validation_error"), 400);
        default:
          return c.json(apiError("unauthorized"), 401);
      }
    });
}
