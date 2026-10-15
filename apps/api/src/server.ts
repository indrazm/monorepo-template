import { serve } from "@hono/node-server";
import { and, eq } from "drizzle-orm";
import { createDatabase } from "@repo/db";
import { member, user } from "@repo/db/schema";
import {
  createCounterQueue,
  createQueueConnection,
  createRealtimeStore,
  createRedisClient,
  createWebhookQueue,
} from "@repo/queue";
import { createApp } from "./app";
import type { createApiConfig } from "./config";
import { createAuth } from "./modules/auth/auth";
import { createMailer } from "./modules/auth/mailer";
import { createCredentialCipher } from "./modules/integrations/credentials";
import { createIntegrationsService } from "./modules/integrations/services";

// Google Places reviews are cached, not streamed (at most 5 per place), so a
// daily re-pull keeps them fresh (FR-NOT-05). A Redis lock keeps a single
// instance doing the work when the API is scaled out.
const REVIEWS_REFRESH_MS = 6 * 60 * 60_000;
const REVIEWS_LOCK_TTL_S = Math.floor(REVIEWS_REFRESH_MS / 1000) - 60;

export function startServer(config: ReturnType<typeof createApiConfig>) {
  const { db, pool } = createDatabase(config.databaseUrl);
  const mailer = createMailer(config.smtp);
  const auth = createAuth(db, config.auth, mailer);

  // Warns the organization owner before (80%) and when (100%) the monthly
  // visitor quota runs out — at 100% notifications stop serving (FR-BIL-01).
  async function sendQuotaWarning(organizationId: string, ratio: number): Promise<void> {
    const [owner] = await db
      .select({ email: user.email, name: user.name })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(and(eq(member.organizationId, organizationId), eq(member.role, "owner")))
      .limit(1);
    if (!owner) return;
    const billingUrl = `${config.clientOrigins[0] ?? ""}/billing`;
    const reached = ratio >= 1;
    await mailer.send({
      to: owner.email,
      subject: reached
        ? "Your Tacto notifications have paused — visitor quota reached"
        : "You have used 80% of your Tacto visitor quota",
      text: reached
        ? `Hi ${owner.name},

Your workspace reached its monthly visitor quota, so Tacto has stopped showing notifications on your site until the quota resets or you upgrade.

Upgrade: ${billingUrl}
`
        : `Hi ${owner.name},

Your workspace has used 80% of its monthly visitor quota. Notifications stop showing once the quota is reached.

Review your plan: ${billingUrl}
`,
    });
  }

  // Redis data connection (impression buffer / live visitors / counter cache)
  // plus BullMQ producers for durable webhook + counter work (SRS §3.3).
  const redis = createRedisClient(config.redisUrl);
  const store = createRealtimeStore(redis);
  const webhookQueue = createWebhookQueue(createQueueConnection(config.redisUrl));
  const counterQueue = createCounterQueue(createQueueConnection(config.redisUrl));

  const app = createApp({
    db,
    config,
    store,
    onQuotaThreshold: (organizationId, ratio) => {
      void sendQuotaWarning(organizationId, ratio).catch((error) =>
        console.error("Quota warning email failed", { organizationId }, error),
      );
    },
    enqueue: {
      webhook: async (job) => {
        await webhookQueue.add(job);
      },
      counter: async (siteId) => {
        await counterQueue.add({ siteId });
      },
    },
    auth: {
      getSession: (headers) => auth.api.getSession({ headers }),
      handler: (request) => auth.handler(request),
    },
  });
  const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
    console.info(`API listening on port ${info.port}`);
  });

  // Scheduled Google reviews refresh.
  const reviewsService = createIntegrationsService(db, {
    cipher: createCredentialCipher(config.credentialsSecret),
    publicApiUrl: config.publicApiUrl,
    server: {
      googleMapsApiKey: config.integrations.googleMapsApiKey,
      shopify: config.integrations.shopify,
      hubspot: config.integrations.hubspot,
    },
  });
  async function refreshReviews(): Promise<void> {
    if (!config.integrations.googleMapsApiKey) return;
    if (!(await store.acquireLock("google-reviews-refresh", REVIEWS_LOCK_TTL_S))) return;
    const result = await reviewsService.refreshAllGoogleReviews();
    if (result.places > 0) console.info("Google reviews refreshed", result);
  }
  const reviewsTimer = setInterval(() => {
    void refreshReviews().catch((error) => console.error("Google reviews refresh failed", error));
  }, REVIEWS_REFRESH_MS);
  reviewsTimer.unref();
  void refreshReviews().catch((error) => console.error("Google reviews refresh failed", error));
  let shuttingDown = false;
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      if (shuttingDown) return;
      shuttingDown = true;
      clearInterval(reviewsTimer);
      server.close(() => {
        void Promise.allSettled([
          pool.end(),
          redis.quit(),
          webhookQueue.close(),
          counterQueue.close(),
        ]).catch((err) => {
          console.error("API shutdown failed", err);
          process.exitCode = 1;
        });
      });
    });
  }
  return server;
}
