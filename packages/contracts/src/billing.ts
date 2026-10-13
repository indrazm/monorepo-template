import { z } from "zod";
import { notificationTypeSchema } from "./notifications";

export const plans = ["free", "starter", "growth", "agency"] as const;
export const planSchema = z.enum(plans);
export type Plan = z.output<typeof planSchema>;

export type PlanLimits = {
  trafficQuota: number; // monthly visitor quota
  maxSites: number;
  removeBadge: boolean;
  notificationTypes: "all" | readonly z.output<typeof notificationTypeSchema>[];
};

// Indicative limits (PRD section 7.2). Prices are validated by market testing.
export const planLimits: Record<Plan, PlanLimits> = {
  free: {
    trafficQuota: 2_000,
    maxSites: 1,
    removeBadge: false,
    notificationTypes: ["recent_sales", "counter", "live_visitors", "custom"],
  },
  starter: { trafficQuota: 10_000, maxSites: 1, removeBadge: true, notificationTypes: "all" },
  growth: { trafficQuota: 100_000, maxSites: 3, removeBadge: true, notificationTypes: "all" },
  agency: { trafficQuota: 200_000, maxSites: 10, removeBadge: true, notificationTypes: "all" },
};

// Indicative monthly price in USD cents (PRD section 7.2); Free has no price.
export const planPricesUsdCents: Record<Plan, number> = {
  free: 0,
  starter: 1_200,
  growth: 3_500,
  agency: 7_900,
};

// Paid plans only — the targets of a Stripe checkout.
export const paidPlanSchema = z.enum(["starter", "growth", "agency"]);
export const createCheckoutSchema = z.object({ plan: paidPlanSchema });
export type CreateCheckoutInput = z.output<typeof createCheckoutSchema>;

export function planAllowsNotificationType(
  plan: Plan,
  type: z.output<typeof notificationTypeSchema>,
): boolean {
  const allowed = planLimits[plan].notificationTypes;
  return allowed === "all" || allowed.includes(type);
}

export const subscriptionSchema = z.object({
  plan: planSchema,
  status: z.string(),
  trafficQuota: z.number().int(),
  usage: z.number().int().default(0),
  renewsAt: z.iso.datetime().nullable(),
});
export type Subscription = z.output<typeof subscriptionSchema>;
