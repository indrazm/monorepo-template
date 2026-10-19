import { createHmac, timingSafeEqual } from "node:crypto";
import type { Plan } from "@repo/contracts/billing";

export type StripeConfig = {
  secretKey: string | null;
  webhookSecret: string | null;
  // Stripe Price IDs per paid plan (from the Dashboard), monthly + annual.
  prices?: Record<Exclude<Plan, "free">, { month: string | null; year: string | null }>;
  // Free-trial days applied at checkout (0 = none).
  trialDays?: number;
};

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
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;
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
  // Stripe customer id (`cus_...`), captured to open the billing portal later.
  customerId: string | null;
  // The subscription will end at the current period end (Portal cancellation).
  cancelAtPeriodEnd?: boolean;
};

function customerIdOf(object: Record<string, unknown>): string | null {
  const customer = object.customer;
  if (typeof customer === "string") return customer;
  if (customer && typeof customer === "object") {
    const id = (customer as { id?: unknown }).id;
    if (typeof id === "string") return id;
  }
  return null;
}

// Maps the active subscription Price back to a Tacto plan. The Billing Portal
// changes items/prices but does not rewrite subscription metadata, so the Price
// ID is the authoritative source for upgrades/downgrades made in the Portal.
function planFromPriceId(priceId: string | null, prices: StripeConfig["prices"]): Plan | null {
  if (!priceId || !prices) return null;
  for (const [plan, ids] of Object.entries(prices)) {
    if (ids.month === priceId || ids.year === priceId) return plan as Plan;
  }
  return null;
}

function priceIdOf(object: Record<string, unknown>): string | null {
  const items = object.items as { data?: { price?: { id?: unknown } }[] } | undefined;
  const id = items?.data?.[0]?.price?.id;
  return typeof id === "string" ? id : null;
}

// Extracts the subscription change we care about from a Stripe event. We only
// act on checkout completion and subscription lifecycle events.
export function parseBillingEvent(
  raw: unknown,
  prices?: StripeConfig["prices"],
): BillingUpdate | null {
  const event = (raw ?? {}) as { type?: string; data?: { object?: Record<string, unknown> } };
  const object = event.data?.object ?? {};
  const metadata = (object.metadata ?? {}) as Record<string, unknown>;
  const organizationId =
    typeof metadata.organizationId === "string" ? metadata.organizationId : null;
  if (!organizationId) return null;

  const customerId = customerIdOf(object);
  switch (event.type) {
    case "checkout.session.completed": {
      const plan = typeof metadata.plan === "string" ? (metadata.plan as Plan) : null;
      return { organizationId, plan, status: "active", renewsAt: null, customerId };
    }
    case "customer.subscription.updated":
    case "customer.subscription.created": {
      const plan =
        planFromPriceId(priceIdOf(object), prices) ??
        (typeof metadata.plan === "string" ? (metadata.plan as Plan) : null);
      const periodEnd =
        typeof object.current_period_end === "number" ? object.current_period_end : null;
      const status = typeof object.status === "string" ? object.status : "active";
      return {
        organizationId,
        plan,
        status,
        renewsAt: periodEnd ? new Date(periodEnd * 1000) : null,
        customerId,
        cancelAtPeriodEnd: object.cancel_at_period_end === true,
      };
    }
    case "customer.subscription.deleted":
      return { organizationId, plan: "free", status: "canceled", renewsAt: null, customerId };
    default:
      return null;
  }
}

// Reads a Price from Stripe so the dashboard shows exactly what Checkout will
// charge (single source of truth for pricing). Returns null when the Price is
// missing or Stripe is unreachable — the caller then falls back and says so.
export type StripePrice = { amount: number | null; currency: string; interval: string };

export async function fetchStripePrice(
  secretKey: string,
  priceId: string,
): Promise<StripePrice | null> {
  try {
    const response = await fetch(
      `https://api.stripe.com/v1/prices/${encodeURIComponent(priceId)}`,
      { headers: { Authorization: `Bearer ${secretKey}` } },
    );
    if (!response.ok) return null;
    const price = (await response.json()) as {
      unit_amount?: number | null;
      currency?: string;
      active?: boolean;
      recurring?: { interval?: string } | null;
    };
    if (price.active === false) return null;
    return {
      amount: typeof price.unit_amount === "number" ? price.unit_amount : null,
      currency: (price.currency ?? "usd").toUpperCase(),
      interval: price.recurring?.interval ?? "month",
    };
  } catch {
    return null;
  }
}

// Creates a Stripe Checkout Session via the REST API (no SDK dependency).
// Returns the hosted checkout URL. Requires STRIPE_SECRET_KEY and a Price ID
// (STRIPE_PRICE_*) so the amount matches the product configured in Stripe.
export async function createCheckoutSession(options: {
  secretKey: string;
  plan: Exclude<Plan, "free">;
  priceId: string;
  organizationId: string;
  successUrl: string;
  cancelUrl: string;
  // Free-trial days (feedback T11); omitted/0 means charge immediately.
  trialDays?: number;
}): Promise<string> {
  const form = new URLSearchParams();
  // Parameters configured in Checkout Studio (fixed_by_ui).
  form.set("ui_mode", "hosted_page");
  form.set("billing_address_collection", "auto");
  form.set("phone_number_collection[enabled]", "false");
  form.set("automatic_tax[enabled]", "false");
  form.set("allow_promotion_codes", "false");
  form.set("submit_type", "auto");
  form.set("integration_identifier", "hosted_web_0001");
  form.set("origin_context", "web");
  // mode is a sample value: "subscription" for recurring billing.
  form.set("mode", "subscription");
  // Payment methods are only collected for subscription mode.
  form.set("payment_method_collection", "always");
  form.set("success_url", options.successUrl);
  form.set("cancel_url", options.cancelUrl);
  // Reference the Price created in the Stripe Dashboard (recurring).
  form.set("line_items[0][price]", options.priceId);
  form.set("line_items[0][quantity]", "1");
  form.set("metadata[organizationId]", options.organizationId);
  form.set("metadata[plan]", options.plan);
  form.set("subscription_data[metadata][organizationId]", options.organizationId);
  form.set("subscription_data[metadata][plan]", options.plan);
  if (options.trialDays && options.trialDays > 0) {
    form.set("subscription_data[trial_period_days]", String(options.trialDays));
  }

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

// Creates a Stripe Billing Portal session so the customer can upgrade, downgrade
// or cancel on their own (SRS FR-BIL-05). Returns the hosted portal URL.
export async function createBillingPortalSession(options: {
  secretKey: string;
  customerId: string;
  returnUrl: string;
}): Promise<string> {
  const form = new URLSearchParams();
  form.set("customer", options.customerId);
  form.set("return_url", options.returnUrl);
  const response = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Stripe portal failed: ${response.status} ${detail.slice(0, 200)}`);
  }
  const session = (await response.json()) as { url?: string };
  if (!session.url) throw new Error("Stripe did not return a portal URL.");
  return session.url;
}
