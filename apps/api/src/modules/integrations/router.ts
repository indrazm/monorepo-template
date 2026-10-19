import { apiError } from "@repo/contracts/errors";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { createIntegrationSchema, updateIntegrationSchema } from "@repo/contracts/integrations";
import { MANAGER_ROLES, type AuthVariables, requireOrg, requireRole } from "../auth/middleware";
import type { IntegrationsService } from "./services";

// Connecting a provider hands Tacto credentials and changes what shows on the
// customer's site, so it is an owner/admin action (FR-AUTH-05).
function manage(
  c: Parameters<typeof requireRole>[0],
): { organizationId: string } | { error: "unauthorized" | "forbidden"; status: 401 | 403 } {
  const result = requireRole(c, ...MANAGER_ROLES);
  if ("error" in result) {
    return { error: result.error, status: result.error === "unauthorized" ? 401 : 403 };
  }
  return result;
}

export function createIntegrationsRouter(service: IntegrationsService) {
  return (
    new Hono<{ Variables: AuthVariables }>()
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
          const allowed = manage(c);
          if ("error" in allowed) return c.json(apiError(allowed.error), allowed.status);
          const { organizationId } = allowed;
          const integration = await service.create(organizationId, c.req.valid("json"));
          return c.json({ integration }, 201);
        },
      )
      // Wizard steps patch the connection: signing secret, API credentials,
      // target site, accepted events, field mapping (FR-INT-01/03).
      .patch(
        "/:id",
        zValidator("json", updateIntegrationSchema, (result, c) => {
          if (!result.success) return c.json(apiError("validation_error"), 400);
        }),
        async (c) => {
          const allowed = manage(c);
          if ("error" in allowed) return c.json(apiError(allowed.error), allowed.status);
          const { organizationId } = allowed;
          const integration = await service.update(
            organizationId,
            c.req.param("id"),
            c.req.valid("json"),
          );
          if (!integration) return c.json(apiError("integration_not_found"), 404);
          return c.json({ integration }, 200);
        },
      )
      // Test connection (FR-INT-04): calls the provider, registers the webhook
      // when possible, and records status/lastError on the integration.
      .post("/:id/verify", async (c) => {
        const allowed = manage(c);
        if ("error" in allowed) return c.json(apiError(allowed.error), allowed.status);
        const { organizationId } = allowed;
        const result = await service.verify(organizationId, c.req.param("id"));
        if (!result) return c.json(apiError("integration_not_found"), 404);
        return c.json(result, 200);
      })
      // Reveal the signing secret only to a manager, and only on demand. It is
      // never part of the list response.
      .get("/:id/secret", async (c) => {
        const allowed = manage(c);
        if ("error" in allowed) return c.json(apiError(allowed.error), allowed.status);
        const result = await service.revealSecret(allowed.organizationId, c.req.param("id"));
        if (!result) return c.json(apiError("integration_not_found"), 404);
        return c.json(result, 200);
      })
      // Mint a new generated secret; old deliveries stop verifying immediately.
      .post("/:id/rotate-secret", async (c) => {
        const allowed = manage(c);
        if ("error" in allowed) return c.json(apiError(allowed.error), allowed.status);
        const result = await service.rotateSecret(allowed.organizationId, c.req.param("id"));
        if (!result) return c.json(apiError("integration_not_found"), 404);
        return c.json(result, 200);
      })
      .delete("/:id", async (c) => {
        const allowed = manage(c);
        if ("error" in allowed) return c.json(apiError(allowed.error), allowed.status);
        const { organizationId } = allowed;
        const removed = await service.remove(organizationId, c.req.param("id"));
        if (!removed) return c.json(apiError("integration_not_found"), 404);
        return c.json({ ok: true }, 200);
      })
  );
}
