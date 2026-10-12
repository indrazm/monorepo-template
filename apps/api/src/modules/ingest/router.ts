import { apiError } from "@repo/contracts/errors";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { ingestEventSchema } from "@repo/contracts/events";
import { createRateLimiter } from "./rate-limit";
import type { createIngestService } from "./services";

// Per-site ingestion cap: 120 events/minute (anti-abuse, SRS FR-VER-03).
const limiter = createRateLimiter({ limit: 120, windowMs: 60_000 });

// Reads the site API key from Authorization: Bearer <key> or X-Api-Key.
function readApiKey(header: string | undefined, bearer: string | undefined): string | null {
  if (header) return header.trim();
  if (bearer?.startsWith("Bearer ")) return bearer.slice("Bearer ".length).trim();
  return null;
}

export function createIngestRouter(service: ReturnType<typeof createIngestService>) {
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
        if (!limiter(`event:${siteId}`)) return c.json(apiError("rate_limited"), 429);
        const result = await service.ingestEvent(siteId, c.req.valid("json"));
        if (result === "duplicate") return c.json(apiError("conflict"), 409);
        return c.json({ ok: true }, 201);
      },
    )
    .post("/v1/webhook/:provider", async (c) => {
      const siteKey = c.req.query("site");
      if (!siteKey) return c.json(apiError("validation_error"), 400);
      if (!limiter(`webhook:${siteKey}`)) return c.json(apiError("rate_limited"), 429);
      const rawBody = await c.req.text();
      const signature = c.req.header("x-tacto-signature") ?? c.req.header("x-signature") ?? null;
      const result = await service.processWebhook({
        siteKey,
        provider: c.req.param("provider"),
        rawBody,
        signature,
      });
      switch (result) {
        case "created":
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
