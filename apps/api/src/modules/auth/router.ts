import { apiError } from "@repo/contracts/errors";
import { Hono } from "hono";
import type { AuthProvider, AuthVariables, SessionMiddleware } from "./middleware";

export function createAuthHandlerRouter(auth: AuthProvider) {
  return new Hono().on(["POST", "GET"], "/*", (c) => auth.handler(c.req.raw));
}

export function createSessionRouter(loadSession: SessionMiddleware) {
  return new Hono<{ Variables: AuthVariables }>().use("*", loadSession).get("/", (c) => {
    const user = c.get("user");
    const session = c.get("session");

    if (!user || !session) return c.json(apiError("unauthorized"), 401);

    return c.json({ session, user }, 200);
  });
}
