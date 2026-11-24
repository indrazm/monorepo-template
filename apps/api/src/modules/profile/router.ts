import { apiError } from "@repo/contracts/errors";
import { updateProfileSchema } from "@repo/contracts/profile";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { AuthVariables, SessionMiddleware } from "../auth/middleware";
import { ProfileNotFoundError, type ProfileService } from "./services";

export function createProfileRouter(service: ProfileService, loadSession: SessionMiddleware) {
  return new Hono<{ Variables: AuthVariables }>().use("*", loadSession).patch(
    "/",
    zValidator("json", updateProfileSchema, (result, c) => {
      if (!result.success) return c.json(apiError("validation_error"), 400);
    }),
    async (c) => {
      const user = c.get("user");

      if (!user) {
        return c.json(apiError("unauthorized"), 401);
      }

      try {
        const result = await service.updateProfile(user.id, c.req.valid("json"));
        return c.json(result, 200);
      } catch (error) {
        if (error instanceof ProfileNotFoundError) return c.json(apiError("user_not_found"), 404);

        throw error;
      }
    },
  );
}
