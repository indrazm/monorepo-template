import { createHmac, timingSafeEqual } from "node:crypto";
import { webhookEventSchema } from "@repo/contracts/integrations";
import type { EventType } from "@repo/contracts/notifications";

export type NormalizedEvent = {
  type: EventType;
  displayName: string | null;
  city: string | null;
  product: string | null;
  dedupeKey: string | null;
  occurredAt: Date;
};

export type VerifyContext = {
  rawBody: string;
  headers: Record<string, string | undefined>;
  secret: string;
};

export type Connector = {
  provider: string;
  // Verifies the provider's webhook signature (SRS FR-ING-04).
  verify: (ctx: VerifyContext) => boolean;
  mapToEvent: (raw: unknown) => NormalizedEvent | null;
};

// ---------- signature helpers ----------
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

function hmacHex(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function hmacBase64(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64");
}

// ---------- mapping helpers ----------
function firstName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.trim().split(/\s+/)[0] || null;
}
function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

// ---------- generic (custom webhook / Zapier) ----------
function genericConnector(provider: string): Connector {
  return {
    provider,
    verify: ({ rawBody, headers, secret }) => {
      const sig = headers["x-tacto-signature"] ?? headers["x-signature"];
      return sig ? safeEqual(hmacHex(secret, rawBody), sig) : false;
    },
    mapToEvent: (raw) => {
      const parsed = webhookEventSchema.safeParse(raw);
      if (!parsed.success) return null;
      const data = parsed.data;
      return {
        type: data.type,
        displayName: firstName(data.name),
        city: str(data.city),
        product: str(data.product),
        dedupeKey: data.dedupeKey ?? null,
        occurredAt: data.occurredAt ? new Date(data.occurredAt) : new Date(),
      };
    },
  };
}

// ---------- Stripe ----------
// Signature header: `t=<ts>,v1=<hex hmac of "ts.body">` (SRS FR-ING-09 Stripe).
const stripeConnector: Connector = {
  provider: "stripe",
  verify: ({ rawBody, headers, secret }) => {
    const header = headers["stripe-signature"];
    if (!header) return false;
    const parts = Object.fromEntries(
      header.split(",").map((kv) => {
        const [k, v] = kv.split("=");
        return [k?.trim(), v?.trim()];
      }),
    );
    const timestamp = parts.t;
    const v1 = parts.v1;
    if (!timestamp || !v1) return false;
    return safeEqual(hmacHex(secret, `${timestamp}.${rawBody}`), v1);
  },
  mapToEvent: (raw) => {
    const obj = (raw ?? {}) as { type?: string; data?: { object?: Record<string, unknown> } };
    const kind = obj.type ?? "";
    if (
      !["checkout.session.completed", "payment_intent.succeeded", "charge.succeeded"].includes(kind)
    ) {
      return null;
    }
    const o = obj.data?.object ?? {};
    const details = (o.customer_details ?? o.billing_details ?? {}) as Record<string, unknown>;
    const address = (details.address ?? {}) as Record<string, unknown>;
    const metadata = (o.metadata ?? {}) as Record<string, unknown>;
    return {
      type: "purchase",
      displayName: firstName(details.name),
      city: str(address.city),
      product: str(metadata.product) ?? str(o.description),
      dedupeKey: str(o.id),
      occurredAt: new Date(),
    };
  },
};

// ---------- Shopify ----------
// Signature header: base64 HMAC-SHA256 of the raw body in X-Shopify-Hmac-Sha256.
const shopifyConnector: Connector = {
  provider: "shopify",
  verify: ({ rawBody, headers, secret }) => {
    const sig = headers["x-shopify-hmac-sha256"];
    return sig ? safeEqual(hmacBase64(secret, rawBody), sig) : false;
  },
  mapToEvent: (raw) => {
    const order = (raw ?? {}) as Record<string, unknown>;
    const customer = (order.customer ?? {}) as Record<string, unknown>;
    const billing = (order.billing_address ?? order.shipping_address ?? {}) as Record<
      string,
      unknown
    >;
    const lineItems = Array.isArray(order.line_items) ? order.line_items : [];
    const firstItem = (lineItems[0] ?? {}) as Record<string, unknown>;
    return {
      type: "purchase",
      displayName: firstName(customer.first_name ?? billing.first_name ?? billing.name),
      city: str(billing.city),
      product: str(firstItem.title ?? firstItem.name),
      dedupeKey: str(order.id) ?? str(order.order_number),
      occurredAt: new Date(),
    };
  },
};

// ---------- WooCommerce ----------
// Signature header: base64 HMAC-SHA256 of the raw body in X-WC-Webhook-Signature.
const wooConnector: Connector = {
  provider: "woocommerce",
  verify: ({ rawBody, headers, secret }) => {
    const sig = headers["x-wc-webhook-signature"];
    return sig ? safeEqual(hmacBase64(secret, rawBody), sig) : false;
  },
  mapToEvent: (raw) => {
    const order = (raw ?? {}) as Record<string, unknown>;
    const billing = (order.billing ?? {}) as Record<string, unknown>;
    const lineItems = Array.isArray(order.line_items) ? order.line_items : [];
    const firstItem = (lineItems[0] ?? {}) as Record<string, unknown>;
    return {
      type: "purchase",
      displayName: firstName(billing.first_name),
      city: str(billing.city),
      product: str(firstItem.name),
      dedupeKey: str(order.id) ?? str(order.number),
      occurredAt: new Date(),
    };
  },
};

const registry: Record<string, Connector> = {
  webhook: genericConnector("webhook"),
  zapier: genericConnector("zapier"),
  stripe: stripeConnector,
  shopify: shopifyConnector,
  woocommerce: wooConnector,
};

export function getConnector(provider: string): Connector | null {
  return registry[provider] ?? null;
}
