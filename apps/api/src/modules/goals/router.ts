import { apiError } from "@repo/contracts/errors";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { createGoalSchema, listGoalsQuerySchema } from "@repo/contracts/goals";
import { type AuthVariables, requireOrg } from "../auth/middleware";
import type { createGoalsService } from "./services";

export function createGoalsRouter(service: ReturnType<typeof createGoalsService>) {
  return new Hono<{ Variables: AuthVariables }>()
    .get(
      "/",
      zValidator("query", listGoalsQuerySchema, (result, c) => {
        if (!result.success) return c.json(apiError("validation_error"), 400);
      }),
      async (c) => {
        const organizationId = requireOrg(c);
        if (!organizationId) return c.json(apiError("unauthorized"), 401);
        const goals = await service.list(organizationId, c.req.valid("query").siteId);
        if (!goals) return c.json(apiError("site_not_found"), 404);
        return c.json({ goals }, 200);
      },
    )
    .post(
      "/",
      zValidator("json", createGoalSchema, (result, c) => {
        if (!result.success) return c.json(apiError("validation_error"), 400);
      }),
      async (c) => {
        const organizationId = requireOrg(c);
        if (!organizationId) return c.json(apiError("unauthorized"), 401);
        const goal = await service.create(organizationId, c.req.valid("json"));
        if (!goal) return c.json(apiError("site_not_found"), 404);
        return c.json({ goal }, 201);
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
