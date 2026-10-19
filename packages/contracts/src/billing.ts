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
  // Custom JS in the widget sandbox (FR-NGS-04) — an advanced, paid feature.
  customCode: boolean;
};

// Indicative limits (PRD section 7.2). Prices are validated by market testing.
export const planLimits: Record<Plan, PlanLimits> = {
  free: {
    trafficQuota: 2_000,
    maxSites: 1,
    removeBadge: false,
    notificationTypes: ["recent_sales", "counter", "live_visitors", "custom"],
    customCode: false,
  },
  starter: {
    trafficQuota: 10_000,
    // Feedback T11: Starter now includes 2 sites so it is clearly above Free
    // (which is 1). Adjust to the final business decision.
    maxSites: 2,
    removeBadge: true,
    notificationTypes: "all",
    customCode: false,
  },
  growth: {
    trafficQuota: 100_000,
    maxSites: 3,
    removeBadge: true,
    notificationTypes: "all",
    customCode: true,
  },
  agency: {
    trafficQuota: 200_000,
    maxSites: 10,
    removeBadge: true,
    notificationTypes: "all",
    customCode: true,
  },
};

// Fallback monthly price in USD cents (PRD section 7.2), used only when Stripe
// has no Price configured for the plan. The displayed price always comes from
// GET /api/v1/billing/plans so the dashboard and Checkout cannot disagree.
export const planPricesUsdCents: Record<Plan, number> = {
  free: 0,
  starter: 1_200,
  growth: 3_500,
  agency: 7_900,
};

// Paid plans only — the targets of a Stripe checkout.
export const paidPlanSchema = z.enum(["starter", "growth", "agency"]);
export const billingIntervals = ["month", "year"] as const;
export const billingIntervalSchema = z.enum(billingIntervals);
export type BillingInterval = z.output<typeof billingIntervalSchema>;
export const createCheckoutSchema = z.object({
  plan: paidPlanSchema,
  // Monthly (default) or annual billing (feedback T11).
  interval: billingIntervalSchema.default("month"),
});
export type CreateCheckoutInput = z.output<typeof createCheckoutSchema>;

export function planAllowsNotificationType(
  plan: Plan,
  type: z.output<typeof notificationTypeSchema>,
): boolean {
  const allowed = planLimits[plan].notificationTypes;
  return allowed === "all" || allowed.includes(type);
}

// Subscription access rights (FR-BIL-01/05): a plan only grants its paid
// entitlements while the subscription is active or trialing. Every other status
// (past_due, unpaid, canceled, incomplete, paused, …) keeps the record but the
// organization falls back to the Free plan's limits. This is the single rule the
// backend uses so access never depends on what the UI happens to show.
export const paidAccessStatuses = ["active", "trialing"] as const;
export function effectivePlanFor(plan: Plan, status: string | null | undefined): Plan {
  return status && (paidAccessStatuses as readonly string[]).includes(status) ? plan : "free";
}
export function hasPaidAccess(status: string | null | undefined): boolean {
  return Boolean(status && (paidAccessStatuses as readonly string[]).includes(status));
}

// One purchasable plan as the dashboard should render it. `amount` is in the
// currency's minor unit (cents) and comes from the Stripe Price when it is
// configured; `source` says which it is, so the UI can flag a stale fallback.
export const planOfferSchema = z.object({
  plan: planSchema,
  label: z.string(),
  amount: z.number().int().nullable(),
  currency: z.string(),
  interval: z.string(),
  trafficQuota: z.number().int(),
  maxSites: z.number().int(),
  removeBadge: z.boolean(),
  // "stripe": live from the Stripe Price. "fallback": Stripe is not configured
  // for this plan, so the indicative price is shown and checkout is disabled.
  source: z.enum(["stripe", "fallback"]),
  purchasable: z.boolean(),
  // Free-trial days offered at checkout (0 = none) — feedback T11.
  trialDays: z.number().int().min(0).default(0),
});
export const planOffersResponseSchema = z.object({ plans: z.array(planOfferSchema) });
export type PlanOffer = z.output<typeof planOfferSchema>;

export const planLabels: Record<Plan, string> = {
  free: "Free",
  starter: "Starter",
  growth: "Growth",
  agency: "Agency",
};

export const subscriptionSchema = z.object({
  plan: planSchema,
  status: z.string(),
  trafficQuota: z.number().int(),
  usage: z.number().int().default(0),
  renewsAt: z.iso.datetime().nullable(),
});
export type Subscription = z.output<typeof subscriptionSchema>;

// What GET /api/v1/billing returns. `plan`/`status` describe the stored
// subscription; `effectivePlan` is what access is actually granted on
// (Free while the subscription is not active). Prices are never here — they
// come from /billing/plans, read live from Stripe.
export const billingOverviewSchema = z.object({
  plan: planSchema,
  status: z.string(),
  active: z.boolean(),
  effectivePlan: planSchema,
  trafficQuota: z.number().int(),
  usage: z.number().int(),
  sitesUsed: z.number().int(),
  maxSites: z.number().int(),
  removeBadge: z.boolean(),
  customCode: z.boolean(),
  renewsAt: z.iso.datetime().nullable(),
  cancelAtPeriodEnd: z.boolean(),
  // A provider customer exists → the billing portal can be opened.
  manageable: z.boolean(),
  // Stripe is reachable/configured, so checkout and the portal can work.
  billingConfigured: z.boolean(),
});
export type BillingOverview = z.output<typeof billingOverviewSchema>;

// One line in the payment history, read from the provider's invoices.
export const invoiceSchema = z.object({
  id: z.string(),
  number: z.string().nullable(),
  amount: z.number().int(),
  currency: z.string(),
  status: z.string(),
  createdAt: z.iso.datetime(),
  hostedUrl: z.string().nullable(),
  pdfUrl: z.string().nullable(),
});
export const invoicesResponseSchema = z.object({ invoices: z.array(invoiceSchema) });
export type Invoice = z.output<typeof invoiceSchema>;
