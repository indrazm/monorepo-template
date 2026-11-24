import { exampleQueueName, type ExampleJob, type ExampleJobResult } from "@repo/contracts/jobs";
import { Worker } from "bullmq";
import { createQueueConnection } from "@repo/queue";
import type { createWorkerConfig } from "./config";
import { processExampleJob } from "./processors/example";

export function runWorker(config: ReturnType<typeof createWorkerConfig>) {
  const worker = new Worker<ExampleJob, ExampleJobResult>(exampleQueueName, processExampleJob, {
    connection: { ...createQueueConnection(config.redisUrl), maxRetriesPerRequest: null },
  });
  worker.on("completed", (job) => console.info("Job completed", { jobId: job.id }));
  worker.on("failed", (job, error) => console.error("Job failed", { jobId: job?.id }, error));
  let shuttingDown = false;
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      if (shuttingDown) return;

      shuttingDown = true;
      void worker.close().catch((err) => {
        console.error("Worker shutdown failed", err);
        process.exitCode = 1;
      });
    });
  }
  return worker;
}
