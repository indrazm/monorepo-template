import { apiError } from "@repo/contracts/errors";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import {
  captureEventSchema,
  spinClaimInputSchema,
  trackEventSchema,
  visitEventSchema,
  widgetConfigQuerySchema,
  widgetPayloadQuerySchema,
} from "@repo/contracts/widget";
import { parseParams } from "./targeting";
import type { createWidgetService } from "./services";

export function createWidgetRouter(
  service: ReturnType<typeof createWidgetService>,
  // Called on a served pageview to record goal conversions (best-effort).
  onPageview?: (siteKey: string, url: string) => void,
) {
  return new Hono()
    .get(
      "/v1/config",
      zValidator("query", widgetConfigQuerySchema, (result, c) => {
        if (!result.success) return c.json(apiError("validation_error"), 400);
      }),
      async (c) => {
        const config = await service.getConfig(c.req.valid("query").site);
        if (!config) return c.json(apiError("site_not_found"), 404);
        c.header("Cache-Control", "public, max-age=30");
        return c.json(config, 200);
      },
    )
    .get(
      "/v1/payload",
      zValidator("query", widgetPayloadQuerySchema, (result, c) => {
        if (!result.success) return c.json(apiError("validation_error"), 400);
      }),
      async (c) => {
        const { site, url, lang, vid, q, ref, vs } = c.req.valid("query");
        const origin = c.req.header("origin") ?? c.req.header("referer") ?? null;
        const requestIp =
          c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
          c.req.header("x-real-ip") ??
          null;
        // Country from the CDN/proxy edge (no IP database needed on our side).
        const country =
          c.req.header("cf-ipcountry") ??
          c.req.header("x-vercel-ip-country") ??
          c.req.header("x-geo-country") ??
          c.req.header("x-country") ??
          null;
        const result = await service.getPayload({
          siteKey: site,
          url,
          origin,
          requestIp,
          country,
          locale: lang ?? null,
          visitorKey: vid ?? null,
          params: parseParams(q),
          referrer: ref ?? null,
          visitor: vs ?? null,
        });
        if (result.kind === "not_found") return c.json(apiError("site_not_found"), 404);
        if (result.kind === "forbidden") return c.json(apiError("forbidden"), 403);
        onPageview?.(site, url);
        c.header("Cache-Control", `public, max-age=${result.payload.ttl}`);
        return c.json(result.payload, 200);
      },
    )
    .post(
      "/v1/spin/claim",
      zValidator("json", spinClaimInputSchema, (result, c) => {
        if (!result.success) return c.json(apiError("validation_error"), 400);
      }),
      async (c) => {
        const origin = c.req.header("origin") ?? c.req.header("referer") ?? null;
        if (!origin) return c.json(apiError("forbidden"), 403);
        const requestIp =
          c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
          c.req.header("x-real-ip") ??
          null;
        const reward = await service.claimSpin(c.req.valid("json"), { origin, requestIp });
        if (!reward) return c.json(apiError("notification_not_found"), 404);
        return c.json(reward, 200);
      },
    )
    .post(
      "/v1/track",
      zValidator("json", trackEventSchema, (result, c) => {
        if (!result.success) return c.json(apiError("validation_error"), 400);
      }),
      async (c) => {
        const input = c.req.valid("json");
        const origin = c.req.header("origin") ?? c.req.header("referer") ?? null;
        if (!origin) return c.json(apiError("forbidden"), 403);
        const requestIp =
          c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
          c.req.header("x-real-ip") ??
          null;
        // Fall back to the request IP as the visitor member for the live window.
        const visitorId = input.visitorId ?? requestIp ?? undefined;
        // Audience dimensions (FR-ANL-02): UA → device/browser/bot, edge header
        // → country. Derived here so the pixel never has to report them.
        const userAgent = c.req.header("user-agent") ?? null;
        const country =
          c.req.header("cf-ipcountry") ??
          c.req.header("x-vercel-ip-country") ??
          c.req.header("x-geo-country") ??
          c.req.header("x-country") ??
          null;
        await service.recordImpression(input, {
          origin,
          requestIp,
          visitorId,
          userAgent,
          country,
        });
        return c.body(null, 204); // best-effort beacon; always ack
      },
    )
    .post(
      "/v1/capture",
      zValidator("json", captureEventSchema, (result, c) => {
        if (!result.success) return c.json(apiError("validation_error"), 400);
      }),
      async (c) => {
        const origin = c.req.header("origin") ?? c.req.header("referer") ?? null;
        if (!origin) return c.json(apiError("forbidden"), 403);
        const requestIp =
          c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
          c.req.header("x-real-ip") ??
          null;
        await service.capture(c.req.valid("json"), { origin, requestIp });
        return c.body(null, 202);
      },
    )
    .post(
      "/v1/visit",
      zValidator("json", visitEventSchema, (result, c) => {
        if (!result.success) return c.json(apiError("validation_error"), 400);
      }),
      async (c) => {
        const origin = c.req.header("origin") ?? c.req.header("referer") ?? null;
        if (!origin) return c.json(apiError("forbidden"), 403);
        const requestIp =
          c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
          c.req.header("x-real-ip") ??
          null;
        await service.recordVisit(c.req.valid("json"), { origin, requestIp });
        return c.body(null, 202);
      },
    );
}
