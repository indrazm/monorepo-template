import { z } from "zod";
import { eventSourceSchema } from "./events";
import { eventTypeSchema, notificationTypeSchema } from "./notifications";

export const analyticsQuerySchema = z.object({
  siteId: z.string().trim().min(1),
  days: z.coerce.number().int().min(1).max(90).default(7),
});

export const analyticsSummarySchema = z.object({
  views: z.number().int(),
  clicks: z.number().int(),
  // Conversion-widget outcomes such as a claimed spin reward (F69).
  claims: z.number().int(),
  ctr: z.number(), // 0..1
  days: z.number().int(),
  perDay: z.array(
    z.object({
      date: z.string(),
      views: z.number().int(),
      clicks: z.number().int(),
      claims: z.number().int(),
    }),
  ),
  // Per-notification breakdown (FR-ANL-02): which notification actually works.
  notifications: z.array(
    z.object({
      notificationId: z.string(),
      name: z.string(),
      type: notificationTypeSchema,
      isActive: z.boolean(),
      views: z.number().int(),
      clicks: z.number().int(),
      claims: z.number().int(),
      ctr: z.number(),
    }),
  ),
  // Per-variant breakdown for A/B tests (FR-ANL-04), with a Wilson 95%
  // interval so a difference in CTR can be read as real or as noise.
  variants: z.array(
    z.object({
      variantId: z.string(),
      notificationId: z.string(),
      views: z.number().int(),
      clicks: z.number().int(),
      ctr: z.number(),
      ctrLow: z.number(),
      ctrHigh: z.number(),
    }),
  ),
  // One entry per notification running an A/B test (FR-ANL-04): which variant
  // leads and whether the difference against the runner-up is significant.
  abTests: z.array(
    z.object({
      notificationId: z.string(),
      name: z.string(),
      leaderVariantId: z.string(),
      runnerUpVariantId: z.string().nullable(),
      // Two-proportion z-test p-value against the runner-up, null when there
      // is nothing to compare against yet.
      pValue: z.number().nullable(),
      significant: z.boolean(),
      // Enough data to call it (both arms past a minimum sample).
      enoughData: z.boolean(),
    }),
  ),
});

export const eventsFeedQuerySchema = z.object({
  siteId: z.string().trim().min(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  // Keyset pagination cursor: the id of the last event on the previous page.
  cursor: z.string().trim().min(1).optional(),
  // Filters (FR-ING-11). Absent = no filtering on that field.
  type: eventTypeSchema.optional(),
  source: eventSourceSchema.optional(),
  verified: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  // Free-text match on the displayed name or city.
  q: z.string().trim().max(120).optional(),
});

// Hot-path impression buffered in Redis and flushed to Postgres by the worker
// (SRS FR-ANL-01/05). Shared by the API producer and the worker consumer.
export const bufferedImpressionSchema = z.object({
  siteId: z.string().trim().min(1),
  refId: z.string().trim().min(1),
  kind: z.enum(["view", "click", "claim"]),
  variantId: z.string().optional(),
  createdAt: z.iso.datetime(),
});

// Onboarding activation snapshot (F70): where a site is in the time-to-value
// funnel, derived from real data (pixel verified, notifications, events shown).
export const activationQuerySchema = z.object({
  siteId: z.string().trim().min(1),
});

export const activationSchema = z.object({
  siteId: z.string(),
  hasPixel: z.boolean(),
  pixelVerifiedAt: z.iso.datetime().nullable(),
  notificationCount: z.number().int(),
  eventCount: z.number().int(),
  impressionCount: z.number().int(),
  firstImpressionAt: z.iso.datetime().nullable(),
  activated: z.boolean(),
  // Time from site creation to the first served impression (ms).
  msToActivation: z.number().int().nullable(),
});

export type ActivationQuery = z.output<typeof activationQuerySchema>;
export type Activation = z.output<typeof activationSchema>;
export type AnalyticsQuery = z.output<typeof analyticsQuerySchema>;
export type AnalyticsSummary = z.output<typeof analyticsSummarySchema>;
export type EventsFeedQuery = z.output<typeof eventsFeedQuerySchema>;
export type BufferedImpression = z.output<typeof bufferedImpressionSchema>;
