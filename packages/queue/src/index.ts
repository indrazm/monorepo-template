import { Queue, QueueEvents, type ConnectionOptions } from "bullmq";
import {
  analyticsJobSchema,
  analyticsQueueName,
  counterJobSchema,
  counterQueueName,
  exampleJobSchema,
  exampleQueueName,
  webhookJobSchema,
  webhookQueueName,
  type AnalyticsJob,
  type CounterJob,
  type ExampleJob,
  type ExampleJobResult,
  type WebhookJob,
} from "@repo/contracts/jobs";

export function createQueueConnection(url: string): ConnectionOptions {
  return { url };
}

export function createExampleQueue(connection: ConnectionOptions) {
  const queue = new Queue<ExampleJob, ExampleJobResult>(exampleQueueName, { connection });
  return {
    add: (input: ExampleJob) => queue.add(exampleQueueName, exampleJobSchema.parse(input)),
    close: () => queue.close(),
  };
}
export function createExampleQueueEvents(connection: ConnectionOptions) {
  return new QueueEvents(exampleQueueName, { connection });
}

// ---------------------------------------------------------------------------
// Tacto queues. Each `add` validates its payload against the shared contract
// so producers (apps/api) and the consumer (apps/worker) stay in sync.
// ---------------------------------------------------------------------------

export function createWebhookQueue(connection: ConnectionOptions) {
  const queue = new Queue<WebhookJob>(webhookQueueName, { connection });
  return {
    add: (input: WebhookJob) => queue.add(webhookQueueName, webhookJobSchema.parse(input)),
    close: () => queue.close(),
  };
}

export function createAnalyticsQueue(connection: ConnectionOptions) {
  const queue = new Queue<AnalyticsJob>(analyticsQueueName, { connection });
  return {
    add: (input: AnalyticsJob = {}) =>
      queue.add(analyticsQueueName, analyticsJobSchema.parse(input)),
    close: () => queue.close(),
  };
}

export function createCounterQueue(connection: ConnectionOptions) {
  const queue = new Queue<CounterJob>(counterQueueName, { connection });
  return {
    add: (input: CounterJob) => queue.add(counterQueueName, counterJobSchema.parse(input)),
    close: () => queue.close(),
  };
}
