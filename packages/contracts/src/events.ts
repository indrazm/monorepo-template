import { z } from "zod";
import { eventTypeSchema } from "./notifications";

export const eventSources = [
  "pixel",
  "webhook",
  "zapier",
  "stripe",
  "shopify",
  "woocommerce",
  "manual",
] as const;
export const eventSourceSchema = z.enum(eventSources);

// Public ingest (POST /ingest/v1/event). Only first name + city are stored for
// display (GDPR data minimization, SRS FR-ING-08).
export const ingestEventSchema = z.object({
  type: eventTypeSchema,
  displayName: z.string().trim().max(80).optional(),
  city: z.string().trim().max(120).optional(),
  product: z.string().trim().max(160).optional(),
  // Caller-provided unique key for idempotency (SRS FR-ING-09).
  dedupeKey: z.string().trim().min(1).max(200).optional(),
  occurredAt: z.iso.datetime().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export const eventSchema = z.object({
  id: z.string(),
  siteId: z.string(),
  type: eventTypeSchema,
  source: eventSourceSchema,
  verified: z.boolean(),
  displayName: z.string().nullable(),
  city: z.string().nullable(),
  occurredAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
});
export const eventsFeedResponseSchema = z.object({
  events: z.array(eventSchema),
  nextCursor: z.string().nullable(),
});

export type IngestEventInput = z.output<typeof ingestEventSchema>;
export type EventSource = z.output<typeof eventSourceSchema>;
export type EventRecord = z.output<typeof eventSchema>;
