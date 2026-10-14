import {
  analyticsQueueName,
  counterQueueName,
  exampleQueueName,
  webhookQueueName,
} from "@repo/contracts/jobs";
import { createDatabase } from "@repo/db";
import {
  createAnalyticsQueue,
  createCounterQueue,
  createQueueConnection,
  createRealtimeStore,
  createRedisClient,
} from "@repo/queue";
import { Worker, type Processor } from "bullmq";
import type { createWorkerConfig } from "./config";
import { createAnalyticsProcessor } from "./processors/analytics-aggregate";
import { createCounterProcessor } from "./processors/counter-recompute";
import { processExampleJob } from "./processors/example";
import { createWebhookProcessor } from "./processors/webhook";

// How often the worker drains the Redis impression buffer into Postgres (F47).
const ANALYTICS_FLUSH_MS = 5_000;

export function runWorker(config: ReturnType<typeof createWorkerConfig>) {
  const { db, pool } = createDatabase(config.databaseUrl);
  const redis = createRedisClient(config.redisUrl);
  const store = createRealtimeStore(redis);

  // BullMQ producers the worker itself uses to follow up on jobs.
  const counterQueue = createCounterQueue(createQueueConnection(config.redisUrl));
  const analyticsQueue = createAnalyticsQueue(createQueueConnection(config.redisUrl));

  const registry: { name: string; processor: Processor }[] = [
    { name: exampleQueueName, processor: processExampleJob },
    {
      name: webhookQueueName,
      processor: createWebhookProcessor(db, async (siteId) => {
        await counterQueue.add({ siteId });
      }),
    },
    { name: analyticsQueueName, processor: createAnalyticsProcessor(db, store) },
    { name: counterQueueName, processor: createCounterProcessor(db, store) },
  ];

  const workers = registry.map(({ name, processor }) => {
    // One ioredis connection per worker (BullMQ takes ownership of blocking ops).
    const worker = new Worker(name, processor, {
      connection: createQueueConnection(config.redisUrl),
    });
    worker.on("ready", () => console.info("Queue listening", { queue: name }));
    worker.on("completed", (job) => console.info("Job completed", { queue: name, jobId: job.id }));
    worker.on("failed", (job, error) =>
      console.error("Job failed", { queue: name, jobId: job?.id }, error),
    );
    return worker;
  });

  // Periodic impression flush (F47) — the API hot path only buffers into Redis.
  void analyticsQueue
    .scheduleFlush(ANALYTICS_FLUSH_MS)
    .catch((error) => console.error("Failed to schedule analytics flush", error));

  let shuttingDown = false;
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      if (shuttingDown) return;
      shuttingDown = true;
      void Promise.allSettled([
        ...workers.map((worker) => worker.close()),
        analyticsQueue.close(),
        counterQueue.close(),
        redis.quit(),
        pool.end(),
      ]).then((results) => {
        const failed = results.find((result) => result.status === "rejected");
        if (failed?.status === "rejected") {
          console.error("Worker shutdown failed", failed.reason);
          process.exitCode = 1;
        }
      });
    });
  }
  return workers;
}
