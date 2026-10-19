import { apiError } from "@repo/contracts/errors";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { AuthVariables } from "../auth/middleware";
import { updateProfileSchema } from "@repo/contracts/profile";
import { ProfileNotFoundError, type createProfileService } from "./services";

export function createProfileRouter(service: ReturnType<typeof createProfileService>) {
  return new Hono<{ Variables: AuthVariables }>()
    .get("/export", async (c) => {
      const user = c.get("user");
      if (!user) return c.json(apiError("unauthorized"), 401);
      try {
        return c.json(await service.exportAccount(user.id), 200);
      } catch (error) {
        if (error instanceof ProfileNotFoundError) return c.json(apiError("user_not_found"), 404);
        throw error;
      }
    })
    .patch(
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
