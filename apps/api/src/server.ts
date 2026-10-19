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

export function startServer(config: ReturnType<typeof createApiConfig>) {
  const { db, pool } = createDatabase(config.databaseUrl);
  const mailer = createMailer(config.email);
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
    // Queue depths surfaced on /metrics (NFR-OBS-02).
    queueMetrics: async () => ({
      webhook: await webhookQueue.counts(),
      counter: await counterQueue.counts(),
    }),
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
