import { apiError } from "@repo/contracts/errors";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { createSiteSchema, domainSettingSchema, updateSiteSchema } from "@repo/contracts/sites";
import { MANAGER_ROLES, type AuthVariables, requireOrg, requireRole } from "../auth/middleware";
import type { createBillingService } from "../billing/services";
import type { createSitesService } from "./services";

export function createSitesRouter(
  service: ReturnType<typeof createSitesService>,
  billing: ReturnType<typeof createBillingService>,
) {
  return (
    new Hono<{ Variables: AuthVariables }>()
      .get("/", async (c) => {
        const organizationId = requireOrg(c);
        if (!organizationId) return c.json(apiError("unauthorized"), 401);
        return c.json({ sites: await service.list(organizationId) }, 200);
      })
      .post(
        "/",
        zValidator("json", createSiteSchema, (result, c) => {
          if (!result.success) {
            return c.json(
              apiError("validation_error", { fields: z.flattenError(result.error).fieldErrors }),
              400,
            );
          }
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
          if (!result.success) {
            return c.json(
              apiError("validation_error", { fields: z.flattenError(result.error).fieldErrors }),
              400,
            );
          }
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
      )
      // Pixel verification check (feedback T5). Any org member can ask.
      .post("/:id/verify", async (c) => {
        const organizationId = requireOrg(c);
        if (!organizationId) return c.json(apiError("unauthorized"), 401);
        const result = await service.verify(organizationId, c.req.param("id"));
        if (!result) return c.json(apiError("site_not_found"), 404);
        return c.json(result, 200);
      })
      // Inject a demo event so the user can preview a notification (feedback T5).
      .post("/:id/test-event", async (c) => {
        const organizationId = requireOrg(c);
        if (!organizationId) return c.json(apiError("unauthorized"), 401);
        const ok = await service.sendTestEvent(organizationId, c.req.param("id"));
        if (ok === null) return c.json(apiError("site_not_found"), 404);
        return c.json({ ok: true }, 201);
      })
      // Data portability (NFR-PRIV-03): export the site's stored events as JSON
      // (default) or CSV (`?format=csv`). Owner/admin only (contains PII).
      .get("/:id/events/export", async (c) => {
        const allowed = requireRole(c, ...MANAGER_ROLES);
        if ("error" in allowed) return c.json(apiError(allowed.error), roleStatus(allowed.error));
        const { organizationId } = allowed;
        const rows = await service.exportEvents(organizationId, c.req.param("id"));
        if (!rows) return c.json(apiError("site_not_found"), 404);
        if (c.req.query("format") === "csv") {
          return c.body(toEventsCsv(rows), 200, {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="tacto-events-${c.req.param("id")}.csv"`,
          });
        }
        return c.json(
          {
            events: rows.map((row) => ({
              id: row.id,
              type: row.type,
              source: row.source,
              verified: row.verified,
              displayName: row.displayName,
              city: row.city,
              payload: row.payload,
              occurredAt: row.occurredAt.toISOString(),
              createdAt: row.createdAt.toISOString(),
            })),
          },
          200,
        );
      })
      // Right to erasure (NFR-PRIV-03): delete every stored event of the site.
      .delete("/:id/events", async (c) => {
        const allowed = requireRole(c, ...MANAGER_ROLES);
        if ("error" in allowed) return c.json(apiError(allowed.error), roleStatus(allowed.error));
        const { organizationId } = allowed;
        const removed = await service.purgeEvents(organizationId, c.req.param("id"));
        if (removed === null) return c.json(apiError("site_not_found"), 404);
        return c.json({ removed }, 200);
      })
  );
}

// Minimal RFC-4180 CSV: quote every field and double embedded quotes.
function toEventsCsv(rows: (typeof import("@repo/db/schema").event.$inferSelect)[]): string {
  const header = "id,type,source,verified,displayName,city,payload,occurredAt,createdAt";
  // RFC-4180 quoting alone does not stop spreadsheet formula injection: a
  // customer-controlled name/city/payload beginning with =, +, - or @ would be
  // evaluated by Excel/LibreOffice. Prefix those cells with an apostrophe.
  const cell = (value: unknown) => {
    let text = value === null || value === undefined ? "" : String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const lines = rows.map((row) =>
    [
      row.id,
      row.type,
      row.source,
      row.verified,
      row.displayName,
      row.city,
      row.payload === null ? "" : JSON.stringify(row.payload),
      row.occurredAt.toISOString(),
      row.createdAt.toISOString(),
    ]
      .map(cell)
      .join(","),
  );
  return [header, ...lines].join("\r\n");
}

// 401 when there is no session/organization, 403 when the role is too low.
function roleStatus(error: "unauthorized" | "forbidden"): 401 | 403 {
  return error === "unauthorized" ? 401 : 403;
}
