import { apiError } from "@repo/contracts/errors";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { ingestEventSchema } from "@repo/contracts/events";
import type { createIngestService } from "./services";

// Reads the site API key from Authorization: Bearer <key> or X-Api-Key.
function readApiKey(header: string | undefined, bearer: string | undefined): string | null {
  if (header) return header.trim();
  if (bearer?.startsWith("Bearer ")) return bearer.slice("Bearer ".length).trim();
  return null;
}

export function createIngestRouter(service: ReturnType<typeof createIngestService>) {
  return new Hono().post(
    "/v1/event",
    zValidator("json", ingestEventSchema, (result, c) => {
      if (!result.success) return c.json(apiError("validation_error"), 400);
    }),
    async (c) => {
      const apiKey = readApiKey(c.req.header("x-api-key"), c.req.header("authorization"));
      if (!apiKey) return c.json(apiError("unauthorized"), 401);
      const siteId = await service.resolveSiteByApiKey(apiKey);
      if (!siteId) return c.json(apiError("unauthorized"), 401);
      const result = await service.ingestEvent(siteId, c.req.valid("json"));
      if (result === "duplicate") return c.json(apiError("conflict"), 409);
      return c.json({ ok: true }, 201);
    },
  );
}
