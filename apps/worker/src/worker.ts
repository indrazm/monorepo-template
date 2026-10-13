import {
  analyticsQueueName,
  counterQueueName,
  exampleQueueName,
  webhookQueueName,
} from "@repo/contracts/jobs";
import { Worker, type Processor } from "bullmq";
import { createQueueConnection } from "@repo/queue";
import type { createWorkerConfig } from "./config";
import { processAnalyticsJob } from "./processors/analytics-aggregate";
import { processCounterJob } from "./processors/counter-recompute";
import { processExampleJob } from "./processors/example";
import { processWebhookJob } from "./processors/webhook";

const registry: { name: string; processor: Processor }[] = [
  { name: exampleQueueName, processor: processExampleJob },
  { name: webhookQueueName, processor: processWebhookJob },
  { name: analyticsQueueName, processor: processAnalyticsJob },
  { name: counterQueueName, processor: processCounterJob },
];

export function runWorker(config: ReturnType<typeof createWorkerConfig>) {
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

  let shuttingDown = false;
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      if (shuttingDown) return;
      shuttingDown = true;
      void Promise.all(workers.map((worker) => worker.close())).catch((error) => {
        console.error("Worker shutdown failed", error);
        process.exitCode = 1;
      });
    });
  }
  return workers;
}
