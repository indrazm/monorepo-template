import { apiError } from "@repo/contracts/errors";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { createSiteSchema, domainSettingSchema, updateSiteSchema } from "@repo/contracts/sites";
import { MANAGER_ROLES, type AuthVariables, requireOrg, requireRole } from "../auth/middleware";
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
        // Only owners/admins manage sites (FR-AUTH-05).
        const allowed = requireRole(c, ...MANAGER_ROLES);
        if ("error" in allowed) return c.json(apiError(allowed.error), roleStatus(allowed.error));
        const { organizationId } = allowed;
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
        const allowed = requireRole(c, ...MANAGER_ROLES);
        if ("error" in allowed) return c.json(apiError(allowed.error), roleStatus(allowed.error));
        const { organizationId } = allowed;
        const site = await service.update(organizationId, c.req.param("id"), c.req.valid("json"));
        if (!site) return c.json(apiError("site_not_found"), 404);
        return c.json({ site }, 200);
      },
    )
    .delete("/:id", async (c) => {
      const allowed = requireRole(c, ...MANAGER_ROLES);
      if ("error" in allowed) return c.json(apiError(allowed.error), roleStatus(allowed.error));
      const { organizationId } = allowed;
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
        const allowed = requireRole(c, ...MANAGER_ROLES);
        if ("error" in allowed) return c.json(apiError(allowed.error), roleStatus(allowed.error));
        const { organizationId } = allowed;
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

// 401 when there is no session/organization, 403 when the role is too low.
function roleStatus(error: "unauthorized" | "forbidden"): 401 | 403 {
  return error === "unauthorized" ? 401 : 403;
}
