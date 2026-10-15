import { serve } from "@hono/node-server";
import { createDatabase } from "@repo/db";
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
  const auth = createAuth(db, config.auth, createMailer(config.smtp));

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
