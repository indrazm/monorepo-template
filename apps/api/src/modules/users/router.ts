import { apiError } from "@repo/contracts/errors";
import { usersQuerySchema } from "@repo/contracts/users";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { getAdminUser, type AuthVariables, type SessionMiddleware } from "../auth/middleware";
import { InvalidUsersCursorError, type UsersService } from "./services";

export function createUsersRouter(service: UsersService, loadSession: SessionMiddleware) {
  return new Hono<{ Variables: AuthVariables }>().use("*", loadSession).get(
    "/",
    zValidator("query", usersQuerySchema, (result, c) => {
      if (!result.success) return c.json(apiError("validation_error"), 400);
    }),
    async (c) => {
      const currentUser = getAdminUser(c);

      if (!currentUser) {
        return c.json(apiError("forbidden"), 403);
      }

      try {
        const result = await service.listRecentUsers(c.req.valid("query"));

        return c.json(result, 200);
      } catch (error) {
        if (error instanceof InvalidUsersCursorError) {
          return c.json(apiError("invalid_cursor"), 400);
        }

        throw error;
      }
    },
  );
}
