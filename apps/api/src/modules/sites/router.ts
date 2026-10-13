import { apiError } from "@repo/contracts/errors";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { createSiteSchema, domainSettingSchema, updateSiteSchema } from "@repo/contracts/sites";
import { type AuthVariables, requireOrg } from "../auth/middleware";
import type { createBillingService } from "../billing/services";
import type { createSitesService } from "./services";

export function createSitesRouter(
  service: ReturnType<typeof createSitesService>,
  billing: ReturnType<typeof createBillingService>,
) {
  return new Hono<{ Variables: AuthVariables }>()
    .get("/", async (c) => {
      const organizationId = requireOrg(c);
      if (!organizationId) return c.json(apiError("unauthorized"), 401);
      return c.json({ sites: await service.list(organizationId) }, 200);
    })
    .post(
      "/",
      zValidator("json", createSiteSchema, (result, c) => {
        if (!result.success) return c.json(apiError("validation_error"), 400);
      }),
      async (c) => {
        const organizationId = requireOrg(c);
        if (!organizationId) return c.json(apiError("unauthorized"), 401);
        if (!(await billing.canCreateSite(organizationId))) {
          return c.json(apiError("plan_limit_reached"), 403);
        }
        const site = await service.create(organizationId, c.req.valid("json"));
        return c.json({ site }, 201);
      },
    )
    .get("/:id", async (c) => {
      const organizationId = requireOrg(c);
      if (!organizationId) return c.json(apiError("unauthorized"), 401);
      const site = await service.get(organizationId, c.req.param("id"));
      if (!site) return c.json(apiError("site_not_found"), 404);
      return c.json({ site }, 200);
    })
    .patch(
      "/:id",
      zValidator("json", updateSiteSchema, (result, c) => {
        if (!result.success) return c.json(apiError("validation_error"), 400);
      }),
      async (c) => {
        const organizationId = requireOrg(c);
        if (!organizationId) return c.json(apiError("unauthorized"), 401);
        const site = await service.update(organizationId, c.req.param("id"), c.req.valid("json"));
        if (!site) return c.json(apiError("site_not_found"), 404);
        return c.json({ site }, 200);
      },
    )
    .delete("/:id", async (c) => {
      const organizationId = requireOrg(c);
      if (!organizationId) return c.json(apiError("unauthorized"), 401);
      const removed = await service.remove(organizationId, c.req.param("id"));
      if (!removed) return c.json(apiError("site_not_found"), 404);
      return c.json({ ok: true }, 200);
    })
    .get("/:id/settings", async (c) => {
      const organizationId = requireOrg(c);
      if (!organizationId) return c.json(apiError("unauthorized"), 401);
      const settings = await service.getSettings(organizationId, c.req.param("id"));
      if (!settings) return c.json(apiError("site_not_found"), 404);
      return c.json({ settings }, 200);
    })
    .put(
      "/:id/settings",
      zValidator("json", domainSettingSchema, (result, c) => {
        if (!result.success) return c.json(apiError("validation_error"), 400);
      }),
      async (c) => {
        const organizationId = requireOrg(c);
        if (!organizationId) return c.json(apiError("unauthorized"), 401);
        const settings = await service.upsertSettings(
          organizationId,
          c.req.param("id"),
          c.req.valid("json"),
        );
        if (!settings) return c.json(apiError("site_not_found"), 404);
        return c.json({ settings }, 200);
      },
    );
}
