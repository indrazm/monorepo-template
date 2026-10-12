import { z } from "zod";

export const exampleQueueName = "example";
export const exampleJobSchema = z.object({ message: z.string().trim().min(1) });
export const exampleJobResultSchema = z.object({ processedAt: z.iso.datetime() });
export type ExampleJob = z.output<typeof exampleJobSchema>;
export type ExampleJobResult = z.output<typeof exampleJobResultSchema>;

// ---------------------------------------------------------------------------
// Tacto job queues (processed by apps/worker)
// ---------------------------------------------------------------------------

// Raw provider webhook, normalized into an Event by the worker (SRS FR-ING-03).
export const webhookQueueName = "webhook";
export const webhookJobSchema = z.object({
  provider: z.string().trim().min(1),
  siteId: z.string().trim().min(1),
  receivedAt: z.iso.datetime(),
  raw: z.record(z.string(), z.unknown()),
});
export type WebhookJob = z.output<typeof webhookJobSchema>;

// Flush buffered impressions from Redis into Postgres + rollups (SRS FR-ANL-05).
export const analyticsQueueName = "analytics-aggregate";
export const analyticsJobSchema = z.object({
  siteId: z.string().trim().min(1).optional(),
});
export type AnalyticsJob = z.output<typeof analyticsJobSchema>;

// Recompute counter aggregates for a notification over its period (SRS FR-NOT-02).
export const counterQueueName = "counter-recompute";
export const counterJobSchema = z.object({
  notificationId: z.string().trim().min(1),
  periodDays: z.number().int().min(1).max(365).default(7),
});
export type CounterJob = z.output<typeof counterJobSchema>;
