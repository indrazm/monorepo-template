import { z } from "zod";

export const analyticsQuerySchema = z.object({
  siteId: z.string().trim().min(1),
  days: z.coerce.number().int().min(1).max(90).default(7),
});

export const analyticsSummarySchema = z.object({
  views: z.number().int(),
  clicks: z.number().int(),
  ctr: z.number(), // 0..1
  days: z.number().int(),
  perDay: z.array(
    z.object({ date: z.string(), views: z.number().int(), clicks: z.number().int() }),
  ),
  // Per-variant breakdown for A/B tests (FR-ANL-04).
  variants: z.array(
    z.object({
      variantId: z.string(),
      notificationId: z.string(),
      views: z.number().int(),
      clicks: z.number().int(),
      ctr: z.number(),
    }),
  ),
});

export const eventsFeedQuerySchema = z.object({
  siteId: z.string().trim().min(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// Hot-path impression buffered in Redis and flushed to Postgres by the worker
// (SRS FR-ANL-01/05). Shared by the API producer and the worker consumer.
export const bufferedImpressionSchema = z.object({
  siteId: z.string().trim().min(1),
  refId: z.string().trim().min(1),
  kind: z.enum(["view", "click"]),
  variantId: z.string().optional(),
  createdAt: z.iso.datetime(),
});

export type AnalyticsQuery = z.output<typeof analyticsQuerySchema>;
export type AnalyticsSummary = z.output<typeof analyticsSummarySchema>;
export type EventsFeedQuery = z.output<typeof eventsFeedQuerySchema>;
export type BufferedImpression = z.output<typeof bufferedImpressionSchema>;
