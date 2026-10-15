import { z } from "zod";
import { eventTypeSchema } from "./notifications";

export const exampleQueueName = "example";
export const exampleJobSchema = z.object({ message: z.string().trim().min(1) });
export const exampleJobResultSchema = z.object({ processedAt: z.iso.datetime() });
export type ExampleJob = z.output<typeof exampleJobSchema>;
export type ExampleJobResult = z.output<typeof exampleJobResultSchema>;

// ---------------------------------------------------------------------------
// Tacto job queues (processed by apps/worker)
// ---------------------------------------------------------------------------

// A webhook event normalized at the API edge (signature verified + mapped via
// the provider connector) and persisted durably by the worker (SRS FR-ING-03).
export const webhookEventSchema = z.object({
  type: eventTypeSchema,
  displayName: z.string().nullable(),
  city: z.string().nullable(),
  product: z.string().nullable(),
  dedupeKey: z.string().nullable(),
  occurredAt: z.iso.datetime(),
  // Review payload (FR-NOT-05), when the provider sent one.
  rating: z.number().int().min(1).max(5).nullish(),
  text: z.string().max(400).nullish(),
});
export const webhookQueueName = "webhook";
export const webhookJobSchema = z.object({
  provider: z.string().trim().min(1),
  siteId: z.string().trim().min(1),
  receivedAt: z.iso.datetime(),
  event: webhookEventSchema,
});
export type WebhookEvent = z.output<typeof webhookEventSchema>;
export type WebhookJob = z.output<typeof webhookJobSchema>;

// Flush buffered impressions from Redis into Postgres + rollups (SRS FR-ANL-05).
export const analyticsQueueName = "analytics-aggregate";
export const analyticsJobSchema = z.object({
  siteId: z.string().trim().min(1).optional(),
});
export type AnalyticsJob = z.output<typeof analyticsJobSchema>;

// Recompute counter/combo aggregates for every such notification on a site and
// cache them in Redis (SRS FR-NOT-02, FR-ANL-05).
export const counterQueueName = "counter-recompute";
export const counterJobSchema = z.object({
  siteId: z.string().trim().min(1),
});
export type CounterJob = z.output<typeof counterJobSchema>;
