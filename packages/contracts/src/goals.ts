import { z } from "zod";
import { eventTypeSchema, urlMatchSchema } from "./notifications";

// A goal records a conversion from one of two signals (FR-ANL-03):
// - "url":   the visitor reaches a URL matching the rule (e.g. a thank-you page).
// - "event": an event of a given type is ingested (e.g. purchase, signup).
export const goalRuleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("url"), url: urlMatchSchema }),
  z.object({ type: z.literal("event"), eventType: eventTypeSchema }),
]);

export const createGoalSchema = z.object({
  siteId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(120),
  rule: goalRuleSchema,
});

export const goalSchema = z.object({
  id: z.string(),
  siteId: z.string(),
  name: z.string(),
  rule: goalRuleSchema,
  conversions: z.number().int(),
  createdAt: z.iso.datetime(),
});

export const listGoalsQuerySchema = z.object({ siteId: z.string().trim().min(1) });

// Conversion analytics for one goal (FR-ANL-03): a daily trend plus attribution
// to the notifications whose impressions preceded each conversion.
export const goalStatsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
  // How long before a conversion a notification view still counts as the cause.
  windowMinutes: z.coerce.number().int().min(1).max(1440).default(30),
});

export const goalStatsSchema = z.object({
  goalId: z.string(),
  days: z.number().int(),
  windowMinutes: z.number().int(),
  total: z.number().int(),
  daily: z.array(z.object({ date: z.string(), conversions: z.number().int() })),
  // Per-notification assisted conversions, highest first. A conversion is
  // assisted by a notification when that notification was viewed (site-wide)
  // within the attribution window before it.
  attribution: z.array(
    z.object({
      notificationId: z.string(),
      name: z.string(),
      conversions: z.number().int(),
    }),
  ),
});

export type GoalRule = z.output<typeof goalRuleSchema>;
export type CreateGoalInput = z.output<typeof createGoalSchema>;
export type Goal = z.output<typeof goalSchema>;
export type GoalStatsQuery = z.output<typeof goalStatsQuerySchema>;
export type GoalStats = z.output<typeof goalStatsSchema>;
