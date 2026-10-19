import { apiError } from "@repo/contracts/errors";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import {
  billingIntervalSchema,
  createCheckoutSchema,
  paidPlanSchema,
  planLabels,
  planLimits,
  planPricesUsdCents,
  type BillingInterval,
  type Plan,
  type PlanOffer,
} from "@repo/contracts/billing";
import { MANAGER_ROLES, type AuthVariables, requireOrg, requireRole } from "../auth/middleware";
import type { createBillingService } from "./services";
import {
  createBillingPortalSession,
  createCheckoutSession,
  fetchStripePrice,
  parseBillingEvent,
  verifyStripeSignature,
  type StripeConfig,
} from "./stripe";

// Prices change rarely; a short cache keeps the billing page snappy without
// letting it drift from Stripe for long.
const PRICE_CACHE_MS = 5 * 60_000;

export function createBillingRouter(
  service: ReturnType<typeof createBillingService>,
  stripe: StripeConfig,
  appUrl: string,
) {
  const cache = new Map<BillingInterval, { at: number; plans: PlanOffer[] }>();
  const trialDays = stripe.trialDays ?? 0;

  // Single source of truth for pricing (audit finding F): the amount shown in
  // the dashboard is the amount on the Stripe Price that Checkout uses. When a
  // plan has no Price configured we return the indicative price, mark it as a
  // fallback and make it non-purchasable instead of lying about the amount.
  async function listPlans(interval: BillingInterval): Promise<PlanOffer[]> {
    const cached = cache.get(interval);
    if (cached && Date.now() - cached.at < PRICE_CACHE_MS) return cached.plans;
    const plans: PlanOffer[] = [];
    for (const plan of paidPlanSchema.options) {
      const limits = planLimits[plan];
      const priceId = stripe.prices?.[plan]?.[interval] ?? null;
      const price =
        stripe.secretKey && priceId ? await fetchStripePrice(stripe.secretKey, priceId) : null;
      // Indicative annual fallback = 10× monthly (2 months free) so the UI has
      // a sensible number before real annual Prices are configured.
      const fallbackAmount =
        interval === "year" ? planPricesUsdCents[plan] * 10 : planPricesUsdCents[plan];
      plans.push({
        plan,
        label: planLabels[plan],
        amount: price ? price.amount : fallbackAmount,
        currency: price?.currency ?? "USD",
        interval: price?.interval ?? interval,
        trafficQuota: limits.trafficQuota,
        maxSites: limits.maxSites,
        removeBadge: limits.removeBadge,
        source: price ? "stripe" : "fallback",
        // Checkout is only useful when the webhook can actually activate the
        // plan; otherwise the customer would pay and never receive it.
        purchasable: Boolean(price && stripe.webhookSecret),
        trialDays,
      });
    }
    const free: Plan = "free";
    plans.unshift({
      plan: free,
      label: planLabels[free],
      amount: 0,
      currency: plans[0]?.currency ?? "USD",
      interval,
      trafficQuota: planLimits[free].trafficQuota,
      maxSites: planLimits[free].maxSites,
      removeBadge: planLimits[free].removeBadge,
      source: "stripe",
      purchasable: false,
      trialDays: 0,
    });
    cache.set(interval, { at: Date.now(), plans });
    return plans;
  }

  return (
    new Hono<{ Variables: AuthVariables }>()
      .get("/", async (c) => {
        const organizationId = requireOrg(c);
        if (!organizationId) return c.json(apiError("unauthorized"), 401);
        const overview = await service.getOverview(organizationId);
        return c.json(
          {
            overview: {
              ...overview,
              billingConfigured: Boolean(stripe.secretKey && stripe.webhookSecret),
            },
          },
          200,
        );
      })
      // Plans + live prices from Stripe (FR-BIL-01/02). `?interval=year` returns
      // annual pricing (feedback T11).
      .get("/plans", async (c) => {
        const parsed = billingIntervalSchema.safeParse(c.req.query("interval"));
        const interval: BillingInterval = parsed.success ? parsed.data : "month";
        return c.json({ plans: await listPlans(interval) }, 200);
      })
      // Authenticated: start a Stripe Checkout for a paid plan (FR-BIL-02).
      .post(
        "/checkout",
        zValidator("json", createCheckoutSchema, (result, c) => {
          if (!result.success) return c.json(apiError("validation_error"), 400);
        }),
        async (c) => {
          // Paying is an owner/admin decision, not a member's (FR-AUTH-05).
          const allowed = requireRole(c, ...MANAGER_ROLES);
          if ("error" in allowed) {
            return c.json(apiError(allowed.error), allowed.error === "unauthorized" ? 401 : 403);
          }
          const { organizationId } = allowed;
          if (!stripe.secretKey) return c.json(apiError("integration_unconfigured"), 400);
          if (!stripe.webhookSecret) return c.json(apiError("integration_unconfigured"), 400);

          // An existing subscriber changes plans in the Billing Portal. Starting
          // a second Checkout would create a duplicate Stripe subscription and
          // canceling either one could wrongly downgrade the organization.
          const existingCustomer = await service.getCustomerId(organizationId);
          if (existingCustomer) {
            try {
              const url = await createBillingPortalSession({
                secretKey: stripe.secretKey,
                customerId: existingCustomer,
                returnUrl: `${appUrl}/billing`,
              });
              return c.json({ url }, 200);
            } catch (error) {
              console.error("Stripe portal failed", error);
              return c.json(apiError("integration_unconfigured"), 502);
            }
          }

          const { plan, interval } = c.req.valid("json");
          const priceId = stripe.prices?.[plan]?.[interval] ?? null;
          if (!priceId) return c.json(apiError("integration_unconfigured"), 400);
          try {
            const url = await createCheckoutSession({
              secretKey: stripe.secretKey,
              plan,
              priceId,
              organizationId,
              successUrl: `${appUrl}/billing?checkout=success`,
              cancelUrl: `${appUrl}/billing?checkout=cancel`,
              trialDays,
            });
            return c.json({ url }, 200);
          } catch (error) {
            console.error("Stripe checkout failed", error);
            return c.json(apiError("integration_unconfigured"), 502);
          }
        },
      )
      // Authenticated: open the Stripe Billing Portal for self-serve
      // upgrade/downgrade/cancel (FR-BIL-05).
      .post("/portal", async (c) => {
        const allowed = requireRole(c, ...MANAGER_ROLES);
        if ("error" in allowed) {
          return c.json(apiError(allowed.error), allowed.error === "unauthorized" ? 401 : 403);
        }
        const { organizationId } = allowed;
        if (!stripe.secretKey) return c.json(apiError("integration_unconfigured"), 400);
        const customerId = await service.getCustomerId(organizationId);
        if (!customerId) return c.json(apiError("conflict"), 400);
        try {
          const url = await createBillingPortalSession({
            secretKey: stripe.secretKey,
            customerId,
            returnUrl: `${appUrl}/billing`,
          });
          return c.json({ url }, 200);
        } catch (error) {
          console.error("Stripe portal failed", error);
          return c.json(apiError("integration_unconfigured"), 502);
        }
      })
      // Public: Stripe webhook updates the subscription (FR-BIL-05). No session;
      // authenticity is the Stripe signature. Mounted here but not behind auth.
      .post("/webhook", async (c) => {
        if (!stripe.webhookSecret) return c.json(apiError("integration_unconfigured"), 503);
        const rawBody = await c.req.text();
        if (
          !verifyStripeSignature(rawBody, c.req.header("stripe-signature"), stripe.webhookSecret)
        ) {
          return c.json(apiError("unauthorized"), 401);
        }
        let raw: unknown;
        try {
          raw = JSON.parse(rawBody);
        } catch {
          return c.json(apiError("validation_error"), 400);
        }
        const update = parseBillingEvent(raw, stripe.prices);
        if (update) await service.updatePlan(update);
        return c.json({ received: true }, 200);
      })
  );
}
