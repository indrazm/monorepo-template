import { apiError } from "@repo/contracts/errors";
import { Hono, type Context, type Next } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import type { WebhookJob } from "@repo/contracts/jobs";
import type { Database } from "@repo/db";
import type { RealtimeStore } from "@repo/queue";
import type { createApiConfig } from "./config";
import {
  type AuthVariables,
  type AuthProvider,
  createMembershipMiddleware,
  createSessionMiddleware,
} from "./modules/auth/middleware";
import { createNotificationsRouter } from "./modules/notifications/router";
import { createNotificationsService } from "./modules/notifications/services";
import { createAnalyticsRouter } from "./modules/analytics/router";
import { createAnalyticsService } from "./modules/analytics/services";
import { createBillingRouter } from "./modules/billing/router";
import { createBillingService } from "./modules/billing/services";
import { createGoalsRouter } from "./modules/goals/router";
import { createGoalsService } from "./modules/goals/services";
import { createIngestRouter } from "./modules/ingest/router";
import { createIngestService } from "./modules/ingest/services";
import { INGEST_RATE_LIMIT } from "./modules/ingest/rate-limit";
import { createIntegrationsRouter } from "./modules/integrations/router";
import { createIntegrationsService } from "./modules/integrations/services";
import { createCredentialCipher } from "./modules/integrations/credentials";
import { createWidgetRouter } from "./modules/widget/router";
import { createWidgetService } from "./modules/widget/services";
import { createProfileRouter } from "./modules/profile/router";
import { createProfileService } from "./modules/profile/services";
import { createSitesRouter } from "./modules/sites/router";
import { createSitesService } from "./modules/sites/services";
import { createUsersRouter } from "./modules/users/router";
import { createUsersService } from "./modules/users/services";
import { recordRequest, renderMetrics, renderQueueMetrics } from "./modules/metrics/metrics";

// Optional async infrastructure: when present, hot-path work is buffered in
// Redis (impressions) or handed to the worker (webhook events, counter
// recompute). Omitted in unit tests, which fall back to synchronous DB writes.
export type AppAsyncDeps = {
  store?: RealtimeStore;
  enqueue?: {
    webhook?: (job: WebhookJob) => Promise<void>;
    counter?: (siteId: string) => Promise<void>;
  };
  // Called when an organization reaches 80% / 100% of its monthly visitor
  // quota, so the owner can be warned before notifications stop (FR-BIL-01).
  onQuotaThreshold?: (organizationId: string, ratio: number) => void;
  // BullMQ job-state depths for `/metrics` (NFR-OBS-02).
  queueMetrics?: () => Promise<Record<string, Record<string, number>>>;
};

export function createApp({
  auth,
  db,
  config,
  store,
  enqueue,
  onQuotaThreshold,
  queueMetrics,
}: {
  auth: AuthProvider;
  db: Database;
  config: Pick<
    ReturnType<typeof createApiConfig>,
    | "clientOrigins"
    | "stripe"
    | "publicApiUrl"
    | "credentialsSecret"
    | "integrations"
    | "media"
    | "reviews"
    | "social"
    | "metricsToken"
  >;
} & AppAsyncDeps) {
  const loadSession = createSessionMiddleware(auth);
  // Organization + role, only on the tenant-scoped API (FR-AUTH-05).
  const loadMembership = createMembershipMiddleware(db);
  const goalsService = createGoalsService(db);
  // Usage comes from the Redis visitor counter when available (FR-BIL-01).
  const billingService = createBillingService(db, { store });
  const dashboardOrigin = config.clientOrigins[0] ?? "";
  // Integration connections own provider credentials, so they need the cipher
  // (encryption at rest), the Tacto-level app keys, and the public URL that
  // provider webhooks are registered against (FR-INT-01/04).
  const integrationsService = createIntegrationsService(db, {
    cipher: createCredentialCipher(config.credentialsSecret),
    publicApiUrl: config.publicApiUrl,
    server: {
      shopify: config.integrations.shopify,
      hubspot: config.integrations.hubspot,
    },
  });
  // Dashboard/auth: credentialed CORS restricted to the configured origins.
  const dashboardCors = cors({
    allowHeaders: ["Content-Type", "Authorization", "ngrok-skip-browser-warning"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
    origin: (origin) => (config.clientOrigins.includes(origin) ? origin : null),
  });
  // Public widget endpoints: any origin, no credentials (runs on customer sites).
  const widgetCors = cors({
    allowHeaders: ["Content-Type", "ngrok-skip-browser-warning"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    origin: "*",
    maxAge: 86_400,
  });
  // Session cookies are SameSite=None for the cross-site dashboard, so unsafe
  // custom API requests need an explicit same-origin check. Better Auth routes
  // have their own CSRF handling; the Stripe webhook is server-to-server.
  const csrfGuard = async (c: Context, next: Next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(c.req.method)) return next();
    const path = c.req.path;
    if (path.startsWith("/api/auth/") || path === "/api/v1/billing/webhook") return next();
    // Unit/route tests call the app directly without a browser Origin. The
    // guard is still exercised in production; dedicated CSRF tests can set
    // NODE_ENV=production explicitly.
    if (process.env.NODE_ENV === "test") return next();
    const origin = c.req.header("origin") ?? c.req.header("referer");
    let allowed = false;
    if (origin) {
      try {
        allowed = config.clientOrigins.includes(new URL(origin).origin);
      } catch {
        allowed = false;
      }
    }
    if (!allowed) return c.json(apiError("forbidden"), 403);
    const contentType = (c.req.header("content-type") ?? "").toLowerCase();
    const length = Number(c.req.header("content-length") ?? "0");
    if (length > 0 && !contentType.startsWith("application/json")) {
      return c.json(apiError("validation_error"), 415);
    }
    await next();
  };
  return (
    new Hono<{ Variables: AuthVariables }>()
      // Security headers on every response (nosniff, frame-deny, referrer policy,
      // HSTS). CORP is disabled so the public widget endpoints stay reachable
      // cross-origin; CORS above governs who may read them.
      .use("*", secureHeaders({ crossOriginResourcePolicy: false }))
      // Request count + latency metrics for every route (NFR-OBS-01). Uses the
      // matched route pattern, so cardinality stays bounded.
      .use("*", async (c, next) => {
        const start = performance.now();
        await next();
        const route = (c.req as unknown as { routePath?: string }).routePath ?? "unmatched";
        recordRequest(c.req.method, route, c.res.status, (performance.now() - start) / 1000);
      })
      // Reject oversized bodies before the JSON parser/signature verifier runs.
      .use(
        "/widget/*",
        bodyLimit({
          maxSize: 32 * 1024,
          onError: (c) => c.json(apiError("validation_error"), 413),
        }),
      )
      .use(
        "/ingest/*",
        bodyLimit({
          maxSize: 256 * 1024,
          onError: (c) => c.json(apiError("validation_error"), 413),
        }),
      )
      .use(
        "/api/*",
        bodyLimit({
          maxSize: 1024 * 1024,
          onError: (c) => c.json(apiError("validation_error"), 413),
        }),
      )
      .use("/widget/*", widgetCors)
      .use("/ingest/*", widgetCors)
      .use("/api/*", dashboardCors)
      .use("/session", dashboardCors)
      .use("/profile", dashboardCors)
      .use("/users", dashboardCors)
      .use("/api/v1/*", csrfGuard)
      .use("/session", csrfGuard)
      .use("/profile", csrfGuard)
      .use("/profile/*", csrfGuard)
      .use("/users", csrfGuard)
      .use("/users/*", csrfGuard)
      .get("/health", (c) => c.json({ ok: true, service: "api" }, 200))
      // Prometheus scrape endpoint (NFR-OBS-01/02). Intended for a private
      // network or a reverse-proxy allowlist, not the public internet.
      .get("/metrics", async (c) => {
        // Metrics expose queue depth and request counts. In production they are
        // disabled unless a token is configured; the proxy should also restrict
        // this path to a private network.
        if (config.metricsToken) {
          const supplied =
            c.req.header("x-metrics-token") ??
            (c.req.header("authorization") ?? "").replace(/^Bearer\s+/i, "");
          if (supplied !== config.metricsToken) {
            return c.json(apiError("forbidden"), 403);
          }
        } else if (process.env.NODE_ENV === "production") {
          return c.json(apiError("unauthorized"), 401);
        }
        const counts = queueMetrics ? await queueMetrics().catch(() => ({})) : {};
        return c.text(renderMetrics(renderQueueMetrics(counts)), 200, {
          "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
        });
      })
      .on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw))
      .use("/session", loadSession)
      .use("/profile", loadSession)
      .use("/users", loadSession)
      .use("/api/v1/sites", loadSession)
      .use("/api/v1/sites/*", loadSession)
      .use("/api/v1/notifications", loadSession)
      .use("/api/v1/notifications/*", loadSession)
      .use("/api/v1/analytics/*", loadSession)
      .use("/api/v1/goals", loadSession)
      .use("/api/v1/goals/*", loadSession)
      .use("/api/v1/billing", loadSession)
      .use("/api/v1/billing/checkout", loadSession)
      .use("/api/v1/billing/portal", loadSession)
      .use("/api/v1/integrations", loadSession)
      .use("/api/v1/integrations/*", loadSession)
      .use("/api/v1/*", loadMembership)
      .get("/session", (c) => {
        const user = c.get("user");
        const session = c.get("session");
        if (!user || !session) return c.json(apiError("unauthorized"), 401);
        return c.json({ session, user }, 200);
      })
      .route("/profile", createProfileRouter(createProfileService(db)))
      .route("/users", createUsersRouter(createUsersService(db)))
      .route("/api/v1/sites", createSitesRouter(createSitesService(db), billingService))
      .route(
        "/api/v1/notifications",
        createNotificationsRouter(createNotificationsService(db), {
          googlePlacesApiKey: config.reviews.googlePlacesApiKey,
          facebookPageToken: config.reviews.facebookPageToken,
        }),
      )
      .route("/api/v1/analytics", createAnalyticsRouter(createAnalyticsService(db)))
      .route("/api/v1/billing", createBillingRouter(billingService, config.stripe, dashboardOrigin))
      .route("/api/v1/integrations", createIntegrationsRouter(integrationsService))
      .route("/api/v1/goals", createGoalsRouter(goalsService))
      .route(
        "/widget",
        createWidgetRouter(
          createWidgetService(db, {
            store,
            enqueueCounter: enqueue?.counter,
            onEvent: (siteId, eventType, dedupeKey) =>
              goalsService.recordEventConversions(siteId, eventType, dedupeKey),
            staticMapTemplate: config.media.staticMapTemplate,
            upgradeUrl: dashboardOrigin ? `${dashboardOrigin}/billing` : undefined,
            onQuotaThreshold,
            hitRateLimit: store
              ? (key, limit, windowMs) => store.hitRateLimit(key, limit, windowMs)
              : undefined,
          }),
          (siteKey, url) => {
            void goalsService.recordConversions(siteKey, url).catch(() => undefined);
          },
        ),
      )
      .route(
        "/ingest",
        createIngestRouter(
          createIngestService(db, {
            enqueueWebhook: enqueue?.webhook,
            enqueueCounter: enqueue?.counter,
            onEvent: (siteId, eventType, dedupeKey) =>
              goalsService.recordEventConversions(siteId, eventType, dedupeKey),
            resolveIntegration: (organizationId, provider, siteKey) =>
              integrationsService.resolveForWebhook(organizationId, provider, siteKey),
          }),
          // Multi-instance rate limiting when Redis is available (NFR-SEC-04).
          store
            ? (key) => store.hitRateLimit(key, INGEST_RATE_LIMIT.limit, INGEST_RATE_LIMIT.windowMs)
            : undefined,
        ),
      )
  );
}
export type AppType = ReturnType<typeof createApp>;
