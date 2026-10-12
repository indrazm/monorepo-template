import { apiError } from "@repo/contracts/errors";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { analyticsQuerySchema, eventsFeedQuerySchema } from "@repo/contracts/analytics";
import { type AuthVariables, requireOrg } from "../auth/middleware";
import type { createAnalyticsService } from "./services";

export function createAnalyticsRouter(service: ReturnType<typeof createAnalyticsService>) {
  return new Hono<{ Variables: AuthVariables }>()
    .get(
      "/summary",
      zValidator("query", analyticsQuerySchema, (result, c) => {
        if (!result.success) return c.json(apiError("validation_error"), 400);
      }),
      async (c) => {
        const organizationId = requireOrg(c);
        if (!organizationId) return c.json(apiError("unauthorized"), 401);
        const { siteId, days } = c.req.valid("query");
        const summary = await service.summary(organizationId, siteId, days);
        if (!summary) return c.json(apiError("site_not_found"), 404);
        return c.json({ summary }, 200);
      },
    )
    .get(
      "/events",
      zValidator("query", eventsFeedQuerySchema, (result, c) => {
        if (!result.success) return c.json(apiError("validation_error"), 400);
      }),
      async (c) => {
        const organizationId = requireOrg(c);
        if (!organizationId) return c.json(apiError("unauthorized"), 401);
        const { siteId, limit } = c.req.valid("query");
        const events = await service.eventsFeed(organizationId, siteId, limit);
        if (!events) return c.json(apiError("site_not_found"), 404);
        return c.json({ events }, 200);
      },
    );
}
