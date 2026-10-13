import { apiError } from "@repo/contracts/errors";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { createIntegrationSchema } from "@repo/contracts/integrations";
import { type AuthVariables, requireOrg } from "../auth/middleware";
import type { createIntegrationsService } from "./services";

export function createIntegrationsRouter(service: ReturnType<typeof createIntegrationsService>) {
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
    });
}
