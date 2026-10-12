import { apiError } from "@repo/contracts/errors";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { widgetPayloadQuerySchema } from "@repo/contracts/widget";
import type { createWidgetService } from "./services";

export function createWidgetRouter(service: ReturnType<typeof createWidgetService>) {
  return new Hono().get(
    "/v1/payload",
    zValidator("query", widgetPayloadQuerySchema, (result, c) => {
      if (!result.success) return c.json(apiError("validation_error"), 400);
    }),
    async (c) => {
      const { site, url } = c.req.valid("query");
      const origin = c.req.header("origin") ?? c.req.header("referer") ?? null;
      const result = await service.getPayload({ siteKey: site, url, origin });
      if (result.kind === "not_found") return c.json(apiError("site_not_found"), 404);
      if (result.kind === "forbidden") return c.json(apiError("forbidden"), 403);
      c.header("Cache-Control", `public, max-age=${result.payload.ttl}`);
      return c.json(result.payload, 200);
    },
  );
}
