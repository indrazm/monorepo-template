import { apiError } from "@repo/contracts/errors";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import {
  activationQuerySchema,
  analyticsQuerySchema,
  eventsFeedQuerySchema,
} from "@repo/contracts/analytics";
import { type AuthVariables, requireOrg } from "../auth/middleware";
import { InvalidEventsCursorError, type createAnalyticsService } from "./services";

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
        const { siteId, days, from, to, compare, includeBots } = c.req.valid("query");
        const summary = await service.summary(organizationId, siteId, {
          days,
          from,
          to,
          compare,
          includeBots,
        });
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
        const { siteId, limit, cursor, type, source, verified, q } = c.req.valid("query");
        try {
          const page = await service.eventsFeed(organizationId, siteId, {
            limit,
            cursor,
            type,
            source,
            verified,
            q,
          });
          if (!page) return c.json(apiError("site_not_found"), 404);
          return c.json(page, 200);
        } catch (error) {
          if (error instanceof InvalidEventsCursorError) {
            return c.json(apiError("invalid_cursor"), 400);
          }
          throw error;
        }
      },
    )
    .get(
      "/activation",
      zValidator("query", activationQuerySchema, (result, c) => {
        if (!result.success) return c.json(apiError("validation_error"), 400);
      }),
      async (c) => {
        const organizationId = requireOrg(c);
        if (!organizationId) return c.json(apiError("unauthorized"), 401);
        const activation = await service.activation(organizationId, c.req.valid("query").siteId);
        if (!activation) return c.json(apiError("site_not_found"), 404);
        return c.json({ activation }, 200);
      },
    );
}
