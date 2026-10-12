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
});

export const eventsFeedQuerySchema = z.object({
  siteId: z.string().trim().min(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type AnalyticsQuery = z.output<typeof analyticsQuerySchema>;
export type AnalyticsSummary = z.output<typeof analyticsSummarySchema>;
export type EventsFeedQuery = z.output<typeof eventsFeedQuerySchema>;
