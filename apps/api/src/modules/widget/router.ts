import { apiError } from "@repo/contracts/errors";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import {
  captureEventSchema,
  trackEventSchema,
  widgetPayloadQuerySchema,
} from "@repo/contracts/widget";
import type { createWidgetService } from "./services";

export function createWidgetRouter(
  service: ReturnType<typeof createWidgetService>,
  // Called on a served pageview to record goal conversions (best-effort).
  onPageview?: (siteKey: string, url: string) => void,
) {
  return new Hono()
    .get(
      "/v1/payload",
      zValidator("query", widgetPayloadQuerySchema, (result, c) => {
        if (!result.success) return c.json(apiError("validation_error"), 400);
      }),
      async (c) => {
        const { site, url } = c.req.valid("query");
        const origin = c.req.header("origin") ?? c.req.header("referer") ?? null;
        const requestIp =
          c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
          c.req.header("x-real-ip") ??
          null;
        const result = await service.getPayload({ siteKey: site, url, origin, requestIp });
        if (result.kind === "not_found") return c.json(apiError("site_not_found"), 404);
        if (result.kind === "forbidden") return c.json(apiError("forbidden"), 403);
        onPageview?.(site, url);
        c.header("Cache-Control", `public, max-age=${result.payload.ttl}`);
        return c.json(result.payload, 200);
      },
    )
    .post(
      "/v1/track",
      zValidator("json", trackEventSchema, (result, c) => {
        if (!result.success) return c.json(apiError("validation_error"), 400);
      }),
      async (c) => {
        await service.recordImpression(c.req.valid("json"));
        return c.body(null, 204); // best-effort beacon; always ack
      },
    )
    .post(
      "/v1/capture",
      zValidator("json", captureEventSchema, (result, c) => {
        if (!result.success) return c.json(apiError("validation_error"), 400);
      }),
      async (c) => {
        await service.capture(c.req.valid("json"));
        return c.body(null, 202);
      },
    );
}
