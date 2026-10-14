import { apiError } from "@repo/contracts/errors";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { createIntegrationSchema } from "@repo/contracts/integrations";
import { type AuthVariables, requireOrg } from "../auth/middleware";
import type { createReviewsService } from "../reviews/services";
import type { createIntegrationsService } from "./services";

const importReviewsSchema = z.object({ siteId: z.string().trim().min(1) });

export function createIntegrationsRouter(
  service: ReturnType<typeof createIntegrationsService>,
  reviews: ReturnType<typeof createReviewsService>,
) {
  return new Hono<{ Variables: AuthVariables }>()
    .get("/", async (c) => {
      const organizationId = requireOrg(c);
      if (!organizationId) return c.json(apiError("unauthorized"), 401);
      return c.json({ integrations: await service.list(organizationId) }, 200);
    })
    .post(
      "/",
      zValidator("json", createIntegrationSchema, (result, c) => {
        if (!result.success) return c.json(apiError("validation_error"), 400);
      }),
      async (c) => {
        const organizationId = requireOrg(c);
        if (!organizationId) return c.json(apiError("unauthorized"), 401);
        const integration = await service.create(organizationId, c.req.valid("json"));
        return c.json({ integration }, 201);
      },
    )
    .delete("/:id", async (c) => {
      const organizationId = requireOrg(c);
      if (!organizationId) return c.json(apiError("unauthorized"), 401);
      const removed = await service.remove(organizationId, c.req.param("id"));
      if (!removed) return c.json(apiError("conflict"), 404);
      return c.json({ ok: true }, 200);
    })
    .post(
      "/:id/import-reviews",
      zValidator("json", importReviewsSchema, (result, c) => {
        if (!result.success) return c.json(apiError("validation_error"), 400);
      }),
      async (c) => {
        const organizationId = requireOrg(c);
        if (!organizationId) return c.json(apiError("unauthorized"), 401);
        const result = await reviews.importReviews(
          organizationId,
          c.req.param("id"),
          c.req.valid("json").siteId,
        );
        if (!result.ok) {
          if (result.reason === "not_found") return c.json(apiError("site_not_found"), 404);
          return c.json(apiError("integration_unconfigured"), 400);
        }
        return c.json({ imported: result.imported, skipped: result.skipped }, 200);
      },
    );
}
