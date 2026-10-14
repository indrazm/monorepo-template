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

export function startServer(config: ReturnType<typeof createApiConfig>) {
  const { db, pool } = createDatabase(config.databaseUrl);
  const auth = createAuth(db, config.auth, createMailer(config.smtp));

  // Redis data connection (impression buffer / live visitors / counter cache)
  // plus BullMQ producers for durable webhook + counter work (SRS §3.3).
  const redis = createRedisClient(config.redisUrl);
  const webhookQueue = createWebhookQueue(createQueueConnection(config.redisUrl));
  const counterQueue = createCounterQueue(createQueueConnection(config.redisUrl));

  const app = createApp({
    db,
    config,
    store: createRealtimeStore(redis),
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
  let shuttingDown = false;
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      if (shuttingDown) return;
      shuttingDown = true;
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
