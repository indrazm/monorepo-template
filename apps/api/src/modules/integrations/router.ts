import { apiError } from "@repo/contracts/errors";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { createIntegrationSchema, updateIntegrationSchema } from "@repo/contracts/integrations";
import { type AuthVariables, requireOrg } from "../auth/middleware";
import type { IntegrationsService } from "./services";

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
          const organizationId = requireOrg(c);
          if (!organizationId) return c.json(apiError("unauthorized"), 401);
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
          const organizationId = requireOrg(c);
          if (!organizationId) return c.json(apiError("unauthorized"), 401);
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
        const organizationId = requireOrg(c);
        if (!organizationId) return c.json(apiError("unauthorized"), 401);
        const result = await service.verify(organizationId, c.req.param("id"));
        if (!result) return c.json(apiError("integration_not_found"), 404);
        return c.json(result, 200);
      })
      // Pull Google Places reviews now instead of waiting for the daily refresh.
      .post("/:id/refresh", async (c) => {
        const organizationId = requireOrg(c);
        if (!organizationId) return c.json(apiError("unauthorized"), 401);
        const result = await service.refreshGoogleReviews(organizationId, c.req.param("id"));
        return c.json(result, result.ok ? 200 : 400);
      })
      .delete("/:id", async (c) => {
        const organizationId = requireOrg(c);
        if (!organizationId) return c.json(apiError("unauthorized"), 401);
        const removed = await service.remove(organizationId, c.req.param("id"));
        if (!removed) return c.json(apiError("integration_not_found"), 404);
        return c.json({ ok: true }, 200);
      })
  );
}
