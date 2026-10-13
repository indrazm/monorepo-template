import { createHmac, timingSafeEqual } from "node:crypto";
import { planPricesUsdCents, type Plan } from "@repo/contracts/billing";

export type StripeConfig = { secretKey: string | null; webhookSecret: string | null };

// Verifies a Stripe webhook signature: header `t=<ts>,v1=<hex hmac of ts.body>`.
export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((kv) => {
      const [k, v] = kv.split("=");
      return [k?.trim(), v?.trim()];
    }),
  );
  const timestamp = parts.t;
  const v1 = parts.v1;
  if (!timestamp || !v1) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type BillingUpdate = {
  organizationId: string;
  plan: Plan | null;
  status: string;
  renewsAt: Date | null;
};

// Extracts the subscription change we care about from a Stripe event. We only
// act on checkout completion and subscription lifecycle events.
export function parseBillingEvent(raw: unknown): BillingUpdate | null {
  const event = (raw ?? {}) as { type?: string; data?: { object?: Record<string, unknown> } };
  const object = event.data?.object ?? {};
  const metadata = (object.metadata ?? {}) as Record<string, unknown>;
  const organizationId =
    typeof metadata.organizationId === "string" ? metadata.organizationId : null;
  if (!organizationId) return null;

  switch (event.type) {
    case "checkout.session.completed": {
      const plan = typeof metadata.plan === "string" ? (metadata.plan as Plan) : null;
      return { organizationId, plan, status: "active", renewsAt: null };
    }
    case "customer.subscription.updated":
    case "customer.subscription.created": {
      const plan = typeof metadata.plan === "string" ? (metadata.plan as Plan) : null;
      const periodEnd =
        typeof object.current_period_end === "number" ? object.current_period_end : null;
      const status = typeof object.status === "string" ? object.status : "active";
      return {
        organizationId,
        plan,
        status,
        renewsAt: periodEnd ? new Date(periodEnd * 1000) : null,
      };
    }
    case "customer.subscription.deleted":
      return { organizationId, plan: "free", status: "canceled", renewsAt: null };
    default:
      return null;
  }
}

// Creates a Stripe Checkout Session via the REST API (no SDK dependency).
// Returns the hosted checkout URL. Requires STRIPE_SECRET_KEY.
export async function createCheckoutSession(options: {
  secretKey: string;
  plan: Exclude<Plan, "free">;
  organizationId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const amount = planPricesUsdCents[options.plan];
  const form = new URLSearchParams();
  form.set("mode", "subscription");
  form.set("success_url", options.successUrl);
  form.set("cancel_url", options.cancelUrl);
  form.set("line_items[0][quantity]", "1");
  form.set("line_items[0][price_data][currency]", "usd");
  form.set("line_items[0][price_data][product_data][name]", `Tacto ${options.plan}`);
  form.set("line_items[0][price_data][unit_amount]", String(amount));
  form.set("line_items[0][price_data][recurring][interval]", "month");
  form.set("metadata[organizationId]", options.organizationId);
  form.set("metadata[plan]", options.plan);
  form.set("subscription_data[metadata][organizationId]", options.organizationId);
  form.set("subscription_data[metadata][plan]", options.plan);

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Stripe checkout failed: ${response.status} ${detail.slice(0, 200)}`);
  }
  const session = (await response.json()) as { url?: string };
  if (!session.url) throw new Error("Stripe did not return a checkout URL.");
  return session.url;
}
