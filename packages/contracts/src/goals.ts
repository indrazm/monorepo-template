import { z } from "zod";
import { urlMatchSchema } from "./notifications";

// A goal fires a conversion when a visitor reaches a URL matching the rule
// (FR-ANL-03). Event-based goals are a later extension.
export const goalRuleSchema = z.object({
  type: z.literal("url").default("url"),
  url: urlMatchSchema,
});

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

export type GoalRule = z.output<typeof goalRuleSchema>;
export type CreateGoalInput = z.output<typeof createGoalSchema>;
export type Goal = z.output<typeof goalSchema>;
