import { apiError } from "@repo/contracts/errors";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { createCheckoutSchema } from "@repo/contracts/billing";
import { type AuthVariables, requireOrg } from "../auth/middleware";
import type { createBillingService } from "./services";
import {
  createBillingPortalSession,
  createCheckoutSession,
  parseBillingEvent,
  verifyStripeSignature,
  type StripeConfig,
} from "./stripe";

export function createBillingRouter(
  service: ReturnType<typeof createBillingService>,
  stripe: StripeConfig,
  appUrl: string,
) {
  return (
    new Hono<{ Variables: AuthVariables }>()
      .get("/", async (c) => {
        const organizationId = requireOrg(c);
        if (!organizationId) return c.json(apiError("unauthorized"), 401);
        return c.json({ overview: await service.getOverview(organizationId) }, 200);
      })
      // Authenticated: start a Stripe Checkout for a paid plan (FR-BIL-02).
      .post(
        "/checkout",
        zValidator("json", createCheckoutSchema, (result, c) => {
          if (!result.success) return c.json(apiError("validation_error"), 400);
        }),
        async (c) => {
          const organizationId = requireOrg(c);
          if (!organizationId) return c.json(apiError("unauthorized"), 401);
          if (!stripe.secretKey) return c.json(apiError("integration_unconfigured"), 400);
          try {
            const url = await createCheckoutSession({
              secretKey: stripe.secretKey,
              plan: c.req.valid("json").plan,
              organizationId,
              successUrl: `${appUrl}/billing?checkout=success`,
              cancelUrl: `${appUrl}/billing?checkout=cancel`,
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
        const organizationId = requireOrg(c);
        if (!organizationId) return c.json(apiError("unauthorized"), 401);
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
        const update = parseBillingEvent(raw);
        if (update) await service.updatePlan(update);
        return c.json({ received: true }, 200);
      })
  );
}
