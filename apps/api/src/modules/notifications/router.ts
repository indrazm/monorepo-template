import { apiError } from "@repo/contracts/errors";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import {
  createNotificationSchema,
  listNotificationsQuerySchema,
  updateNotificationSchema,
} from "@repo/contracts/notifications";
import { type AuthVariables, requireOrg } from "../auth/middleware";
import { fetchFacebookReviews, fetchGooglePlacesReviews } from "../reviews/providers";
import type { createNotificationsService } from "./services";

// Live review import (feedback T6). `ref` is a Google Place ID or Facebook Page ID.
const importReviewsSchema = z.object({
  provider: z.enum(["google", "facebook"]),
  ref: z.string().trim().min(1).max(200),
});

export type ReviewProviderConfig = {
  googlePlacesApiKey: string | null;
  facebookPageToken: string | null;
};

export function createNotificationsRouter(
  service: ReturnType<typeof createNotificationsService>,
  reviewProviders: ReviewProviderConfig = { googlePlacesApiKey: null, facebookPageToken: null },
) {
  return (
    new Hono<{ Variables: AuthVariables }>()
      // Import reviews from a connected provider into a review notification. The
      // credential is server-side; absent → integration_unconfigured (T6).
      .post(
        "/:id/import-reviews",
        zValidator("json", importReviewsSchema, (result, c) => {
          if (!result.success) return c.json(apiError("validation_error"), 400);
        }),
        async (c) => {
          const organizationId = requireOrg(c);
          if (!organizationId) return c.json(apiError("unauthorized"), 401);
          const notification = await service.get(organizationId, c.req.param("id"));
          if (!notification) return c.json(apiError("notification_not_found"), 404);
          const { provider, ref } = c.req.valid("json");
          try {
            const imported =
              provider === "google"
                ? reviewProviders.googlePlacesApiKey
                  ? await fetchGooglePlacesReviews(reviewProviders.googlePlacesApiKey, ref)
                  : null
                : reviewProviders.facebookPageToken
                  ? await fetchFacebookReviews(reviewProviders.facebookPageToken, ref)
                  : null;
            if (imported === null) return c.json(apiError("integration_unconfigured"), 400);
            const merged = [...(notification.config.reviews ?? []), ...imported].slice(0, 50);
            const updated = await service.update(organizationId, notification.id, {
              config: { ...notification.config, reviews: merged },
            });
            return c.json({ imported: imported.length, notification: updated }, 200);
          } catch {
            return c.json(apiError("conflict", { message: "Could not fetch reviews." }), 502);
          }
        },
      )
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
      })
  );
}
