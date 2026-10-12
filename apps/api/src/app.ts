import { apiError } from "@repo/contracts/errors";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Database } from "@repo/db";
import type { createApiConfig } from "./config";
import {
  type AuthVariables,
  type AuthProvider,
  createSessionMiddleware,
} from "./modules/auth/middleware";
import { createProfileRouter } from "./modules/profile/router";
import { createProfileService } from "./modules/profile/services";
import { createSitesRouter } from "./modules/sites/router";
import { createSitesService } from "./modules/sites/services";
import { createUsersRouter } from "./modules/users/router";
import { createUsersService } from "./modules/users/services";

export function createApp({
  auth,
  db,
  config,
}: {
  auth: AuthProvider;
  db: Database;
  config: Pick<ReturnType<typeof createApiConfig>, "clientOrigins">;
}) {
  const loadSession = createSessionMiddleware(auth, db);
  return new Hono<{ Variables: AuthVariables }>()
    .use(
      "*",
      cors({
        allowHeaders: ["Content-Type", "Authorization"],
        allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        credentials: true,
        origin: (origin) => (config.clientOrigins.includes(origin) ? origin : null),
      }),
    )
    .get("/health", (c) => c.json({ ok: true, service: "api" }, 200))
    .on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw))
    .use("/session", loadSession)
    .use("/profile", loadSession)
    .use("/users", loadSession)
    .use("/api/v1/sites", loadSession)
    .use("/api/v1/sites/*", loadSession)
    .get("/session", (c) => {
      const user = c.get("user");
      const session = c.get("session");
      if (!user || !session) return c.json(apiError("unauthorized"), 401);
      return c.json({ session, user }, 200);
    })
    .route("/profile", createProfileRouter(createProfileService(db)))
    .route("/users", createUsersRouter(createUsersService(db)))
    .route("/api/v1/sites", createSitesRouter(createSitesService(db)));
}
export type AppType = ReturnType<typeof createApp>;
