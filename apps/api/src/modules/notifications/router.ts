import { apiError } from "@repo/contracts/errors";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import {
  createNotificationSchema,
  listNotificationsQuerySchema,
  updateNotificationSchema,
} from "@repo/contracts/notifications";
import { type AuthVariables, requireOrg } from "../auth/middleware";
import type { createNotificationsService } from "./services";

export function createNotificationsRouter(service: ReturnType<typeof createNotificationsService>) {
  return new Hono<{ Variables: AuthVariables }>()
    .get(
      "/",
      zValidator("query", listNotificationsQuerySchema, (result, c) => {
        if (!result.success) return c.json(apiError("validation_error"), 400);
      }),
      async (c) => {
        const organizationId = requireOrg(c);
        if (!organizationId) return c.json(apiError("unauthorized"), 401);
        const notifications = await service.list(organizationId, c.req.valid("query").siteId);
        if (!notifications) return c.json(apiError("site_not_found"), 404);
        return c.json({ notifications }, 200);
      },
    )
    .post(
      "/",
      zValidator("json", createNotificationSchema, (result, c) => {
        if (!result.success) return c.json(apiError("validation_error"), 400);
      }),
      async (c) => {
        const organizationId = requireOrg(c);
        if (!organizationId) return c.json(apiError("unauthorized"), 401);
        const input = c.req.valid("json");
        if (!(await service.planAllows(organizationId, input.type))) {
          return c.json(apiError("plan_limit_reached"), 403);
        }
        const notification = await service.create(organizationId, input);
        if (!notification) return c.json(apiError("site_not_found"), 404);
        return c.json({ notification }, 201);
      },
    )
    .get("/:id", async (c) => {
      const organizationId = requireOrg(c);
      if (!organizationId) return c.json(apiError("unauthorized"), 401);
      const notification = await service.get(organizationId, c.req.param("id"));
      if (!notification) return c.json(apiError("notification_not_found"), 404);
      return c.json({ notification }, 200);
    })
    .patch(
      "/:id",
      zValidator("json", updateNotificationSchema, (result, c) => {
        if (!result.success) return c.json(apiError("validation_error"), 400);
      }),
      async (c) => {
        const organizationId = requireOrg(c);
        if (!organizationId) return c.json(apiError("unauthorized"), 401);
        const input = c.req.valid("json");
        if (input.type && !(await service.planAllows(organizationId, input.type))) {
          return c.json(apiError("plan_limit_reached"), 403);
        }
        const notification = await service.update(organizationId, c.req.param("id"), input);
        if (!notification) return c.json(apiError("notification_not_found"), 404);
        return c.json({ notification }, 200);
      },
    )
    .delete("/:id", async (c) => {
      const organizationId = requireOrg(c);
      if (!organizationId) return c.json(apiError("unauthorized"), 401);
      const removed = await service.remove(organizationId, c.req.param("id"));
      if (!removed) return c.json(apiError("notification_not_found"), 404);
      return c.json({ ok: true }, 200);
    });
}
