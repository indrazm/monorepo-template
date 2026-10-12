import { apiError } from "@repo/contracts/errors";
import { Hono } from "hono";
import { type AuthVariables, requireOrg } from "../auth/middleware";
import type { createBillingService } from "./services";

export function createBillingRouter(service: ReturnType<typeof createBillingService>) {
  return new Hono<{ Variables: AuthVariables }>().get("/", async (c) => {
    const organizationId = requireOrg(c);
    if (!organizationId) return c.json(apiError("unauthorized"), 401);
    return c.json({ overview: await service.getOverview(organizationId) }, 200);
  });
}
