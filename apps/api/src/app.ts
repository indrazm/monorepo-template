import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Database } from "@repo/db";
import type { createApiConfig } from "./lib/config";
import {
  type AuthProvider,
  type AuthVariables,
  createSessionMiddleware,
} from "./modules/auth/middleware";
import { createAuthHandlerRouter, createSessionRouter } from "./modules/auth/router";
import { createProfileRouter } from "./modules/profile/router";
import { createProfileService, type ProfileService } from "./modules/profile/services";
import { createUsersRouter } from "./modules/users/router";
import { createUsersService, type UsersService } from "./modules/users/services";

type AppServices = {
  profile: ProfileService;
  users: UsersService;
};

type CreateAppOptions = {
  auth: AuthProvider;
  config: Pick<ReturnType<typeof createApiConfig>, "clientOrigins">;
} & ({ db: Database; services?: Partial<AppServices> } | { db?: undefined; services: AppServices });

export function createApp(options: CreateAppOptions) {
  const { auth, config } = options;
  const profileService =
    options.services?.profile ?? createProfileService(requireDatabase(options.db));
  const usersService = options.services?.users ?? createUsersService(requireDatabase(options.db));
  const loadSession = createSessionMiddleware(auth);

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
    .route("/api/auth", createAuthHandlerRouter(auth))
    .route("/session", createSessionRouter(loadSession))
    .route("/profile", createProfileRouter(profileService, loadSession))
    .route("/users", createUsersRouter(usersService, loadSession));
}

function requireDatabase(db: Database | undefined): Database {
  if (!db) {
    throw new Error("A database instance is required when services are not provided.");
  }

  return db;
}

export type AppType = ReturnType<typeof createApp>;
