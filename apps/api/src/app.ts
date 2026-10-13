import { apiError } from "@repo/contracts/errors";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import type { Database } from "@repo/db";
import type { createApiConfig } from "./config";
import {
  type AuthVariables,
  type AuthProvider,
  createSessionMiddleware,
} from "./modules/auth/middleware";
import { createNotificationsRouter } from "./modules/notifications/router";
import { createNotificationsService } from "./modules/notifications/services";
import { createAnalyticsRouter } from "./modules/analytics/router";
import { createAnalyticsService } from "./modules/analytics/services";
import { createBillingRouter } from "./modules/billing/router";
import { createBillingService } from "./modules/billing/services";
import { createIngestRouter } from "./modules/ingest/router";
import { createIngestService } from "./modules/ingest/services";
import { createIntegrationsRouter } from "./modules/integrations/router";
import { createIntegrationsService } from "./modules/integrations/services";
import { createWidgetRouter } from "./modules/widget/router";
import { createWidgetService } from "./modules/widget/services";
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
  // Dashboard/auth: credentialed CORS restricted to the configured origins.
  const dashboardCors = cors({
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
    origin: (origin) => (config.clientOrigins.includes(origin) ? origin : null),
  });
  // Public widget endpoints: any origin, no credentials (runs on customer sites).
  const widgetCors = cors({
    allowMethods: ["GET", "POST", "OPTIONS"],
    origin: "*",
    maxAge: 86_400,
  });
  return (
    new Hono<{ Variables: AuthVariables }>()
      // Security headers on every response (nosniff, frame-deny, referrer policy,
      // HSTS). CORP is disabled so the public widget endpoints stay reachable
      // cross-origin; CORS above governs who may read them.
      .use("*", secureHeaders({ crossOriginResourcePolicy: false }))
      .use("/widget/*", widgetCors)
      .use("/ingest/*", widgetCors)
      .use("/api/*", dashboardCors)
      .use("/session", dashboardCors)
      .use("/profile", dashboardCors)
      .use("/users", dashboardCors)
      .get("/health", (c) => c.json({ ok: true, service: "api" }, 200))
      .on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw))
      .use("/session", loadSession)
      .use("/profile", loadSession)
      .use("/users", loadSession)
      .use("/api/v1/sites", loadSession)
      .use("/api/v1/sites/*", loadSession)
      .use("/api/v1/notifications", loadSession)
      .use("/api/v1/notifications/*", loadSession)
      .use("/api/v1/analytics/*", loadSession)
      .use("/api/v1/billing", loadSession)
      .use("/api/v1/integrations", loadSession)
      .use("/api/v1/integrations/*", loadSession)
      .get("/session", (c) => {
        const user = c.get("user");
        const session = c.get("session");
        if (!user || !session) return c.json(apiError("unauthorized"), 401);
        return c.json({ session, user }, 200);
      })
      .route("/profile", createProfileRouter(createProfileService(db)))
      .route("/users", createUsersRouter(createUsersService(db)))
      .route("/api/v1/sites", createSitesRouter(createSitesService(db), createBillingService(db)))
      .route("/api/v1/notifications", createNotificationsRouter(createNotificationsService(db)))
      .route("/api/v1/analytics", createAnalyticsRouter(createAnalyticsService(db)))
      .route("/api/v1/billing", createBillingRouter(createBillingService(db)))
      .route("/api/v1/integrations", createIntegrationsRouter(createIntegrationsService(db)))
      .route("/widget", createWidgetRouter(createWidgetService(db)))
      .route("/ingest", createIngestRouter(createIngestService(db)))
  );
}
export type AppType = ReturnType<typeof createApp>;
