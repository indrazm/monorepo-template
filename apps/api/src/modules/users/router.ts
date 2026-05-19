import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { requireRole } from "../auth/services";
import { usersQuerySchema } from "./schema";
import { listRecentUsers } from "./services";

export const usersRouter = new Hono().get("/", zValidator("query", usersQuerySchema), async (c) => {
  const currentUser = await requireRole(c, "ADMIN");

  if (!currentUser) {
    return c.json({ error: "forbidden" }, 403);
  }

  const users = await listRecentUsers();

  return c.json({ users });
});
