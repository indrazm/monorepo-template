import { createHmac, timingSafeEqual } from "node:crypto";
import { webhookEventSchema } from "@repo/contracts/integrations";
import type { IntegrationProvider } from "@repo/contracts/integrations";
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
  // Verifies the provider's webhook signature (SRS FR-ING-04). Tolerant: tries
  // the provider's native scheme, then falls back to the generic Tacto header.
  verify: (ctx: VerifyContext) => boolean;
  mapToEvent: (raw: unknown) => NormalizedEvent | null;
};

// ---------- signature helpers ----------
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

function encode(secret: string, payload: string, encoding: "hex" | "base64"): string {
  return createHmac("sha256", secret).update(payload).digest(encoding);
}

function headerValue(
  headers: Record<string, string | undefined>,
  names: string[],
): string | undefined {
  for (const name of names) {
    const value = headers[name.toLowerCase()];
    if (value) return value;
  }
  return undefined;
}

function stripPrefix(value: string, prefix: string | undefined): string {
  if (prefix && value.startsWith(prefix)) return value.slice(prefix.length);
  return value;
}

function match(value: string, expected: string, prefix?: string): boolean {
  return safeEqual(stripPrefix(value, prefix), expected);
}

// Parses composite signature headers like `t=123,v1=abc` or `ts=123;h1=abc`.
function parsePairs(header: string, separator: ";" | ","): Record<string, string> {
  return Object.fromEntries(
    header.split(separator).map((part) => {
      const [key, value] = part.split("=");
      return [key?.trim() ?? "", value?.trim() ?? ""];
    }),
  );
}

// Compares the request against any of the given headers, each being an HMAC of
// the raw body (optionally with a prefix such as `sha256=`).
function bodyHmac(
  names: string[],
  encoding: "hex" | "base64",
  prefix?: string,
): (ctx: VerifyContext) => boolean {
  return (ctx) => {
    const value = headerValue(ctx.headers, names);
    if (!value) return false;
    return match(value, encode(ctx.secret, ctx.rawBody, encoding), prefix);
  };
}

// Stripe: `Stripe-Signature: t=<ts>,v1=<hex hmac of "ts.body">`.
function verifyStripe(ctx: VerifyContext): boolean {
  const header = headerValue(ctx.headers, ["stripe-signature"]);
  if (!header) return false;
  const parts = parsePairs(header, ",");
  if (!parts.t || !parts.v1) return false;
  return match(parts.v1, encode(ctx.secret, `${parts.t}.${ctx.rawBody}`, "hex"));
}

// Calendly: `Calendly-Webhook-Signature: t=<ts>,v1=<base64 hmac of "ts.body">`.
function verifyCalendly(ctx: VerifyContext): boolean {
  const header = headerValue(ctx.headers, ["calendly-webhook-signature"]);
  if (!header) return false;
  const parts = parsePairs(header, ",");
  if (!parts.t || !parts.v1) return false;
  return match(parts.v1, encode(ctx.secret, `${parts.t}.${ctx.rawBody}`, "base64"));
}

// Paddle: `Paddle-Signature: ts=<ts>;h1=<hex hmac of "ts:body">`.
function verifyPaddle(ctx: VerifyContext): boolean {
  const header = headerValue(ctx.headers, ["paddle-signature"]);
  if (!header) return false;
  const parts = parsePairs(header, ";");
  if (!parts.ts || !parts.h1) return false;
  return match(parts.h1, encode(ctx.secret, `${parts.ts}:${ctx.rawBody}`, "hex"));
}

// HubSpot (v1): `X-HubSpot-Signature` = sha256(secret + body) as hex.
function verifyHubspot(ctx: VerifyContext): boolean {
  const value = headerValue(ctx.headers, ["x-hubspot-signature"]);
  if (!value) return false;
  return match(value, encode(ctx.secret, ctx.secret + ctx.rawBody, "hex"));
}

// Generic fallback every provider can use: HMAC-SHA256 of the body in
// `x-tacto-signature` / `x-signature` (hex or base64, optional `sha256=` prefix).
function verifyGeneric(ctx: VerifyContext): boolean {
  const value = headerValue(ctx.headers, ["x-tacto-signature", "x-signature"]);
  if (!value) return false;
  const candidates = [
    encode(ctx.secret, ctx.rawBody, "hex"),
    encode(ctx.secret, ctx.rawBody, "base64"),
  ];
  return candidates.some((candidate) => match(value, candidate, "sha256="));
}

// ---------- mapping helpers ----------
function readPath(obj: unknown, path: string): unknown {
  let current: unknown = obj;
  for (const key of path.split(".")) {
    if (Array.isArray(current)) {
      const index = Number(key);
      current = Number.isInteger(index) ? current[index] : undefined;
    } else if (current && typeof current === "object") {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
    if (current === undefined || current === null) return undefined;
  }
  return current;
}

function pick(obj: unknown, paths: string[]): string | undefined {
  for (const path of paths) {
    const value = readPath(obj, path);
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

function firstName(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.trim().split(/\s+/)[0] || null;
}

function str(value: string | undefined): string | null {
  return value && value.trim() ? value.trim() : null;
}

function dateOf(value: string | undefined): Date {
  if (!value) return new Date();
  const millis = /^\d+$/.test(value) ? Number(value) * 1000 : Date.parse(value);
  return Number.isFinite(millis) ? new Date(millis) : new Date();
}

// Maps a provider/event hint onto a Tacto event type, falling back to the
// provider's default (orders → purchase, forms → form_submit, etc.).
function mapType(hint: string | undefined, fallback: EventType): EventType {
  const value = (hint ?? "").toLowerCase();
  if (!value) return fallback;
  if (/(purchase|order|paid|payment|checkout|sale|charge|transaction|invoice)/.test(value)) {
    return "purchase";
  }
  if (/(signup|register|subscrib|account|lead|member|create_user|user_created)/.test(value)) {
    return "signup";
  }
  if (/(review|rating)/.test(value)) return "review";
  if (/(form|submit|submission|response|contact|enquir|inquir|application)/.test(value)) {
    return "form_submit";
  }
  if (/(visit|pageview|page_view)/.test(value)) return "visit";
  return fallback;
}

const NAME_PATHS = [
  "customer.first_name",
  "customer_details.name",
  "customer.name",
  "customer.full_name",
  "billing.first_name",
  "billing.name",
  "billing_address.first_name",
  "shipping_address.first_name",
  "shipping.first_name",
  "address.first_name",
  "buyer.first_name",
  "subscriber.first_name",
  "member.first_name",
  "user.first_name",
  "fields.name",
  "fields.first_name",
  "first_name",
  "full_name",
  "customer_name",
  "name",
  "data.customer.first_name",
  "data.buyer.first_name",
  "data.object.customer_details.name",
  "data.object.customer.first_name",
  "data.attributes.customer_name",
];
const EMAIL_PATHS = [
  "customer.email",
  "billing.email",
  "email",
  "buyer.email",
  "subscriber.email",
  "member.email",
  "user.email",
  "fields.email",
  "data.email",
];
const CITY_PATHS = [
  "billing.city",
  "billing_address.city",
  "shipping_address.city",
  "shipping.city",
  "customer_details.address.city",
  "address.city",
  "customer.city",
  "buyer.city",
  "member.city",
  "city",
  "fields.city",
  "data.billing.city",
  "data.city",
  "data.object.customer_details.address.city",
  "data.object.billing_details.address.city",
  "data.object.customer.address.city",
];
const PRODUCT_PATHS = [
  "line_items.0.title",
  "line_items.0.name",
  "items.0.title",
  "items.0.name",
  "order_items.0.name",
  "product.name",
  "product.title",
  "plan.name",
  "variant.title",
  "variant.name",
  "course.name",
  "product",
  "plan",
  "product_name",
  "data.product.name",
  "data.attributes.product_name",
  "data.object.metadata.product",
];
const DEDUPE_PATHS = [
  "id",
  "order_id",
  "order_number",
  "checkout_id",
  "transaction_id",
  "event_id",
  "eventId",
  "data.id",
  "data.object.id",
  "data.order_id",
  "payload.id",
  "token",
  "response_id",
];
const TIME_PATHS = [
  "created_at",
  "createdAt",
  "occurred_at",
  "submitted_at",
  "timestamp",
  "event.created_at",
  "data.created_at",
  "data.object.created_at",
  "data.object.created",
];
const TYPE_PATHS = [
  "type",
  "event",
  "event_type",
  "eventType",
  "topic",
  "data.type",
  "data.event",
  "data.attributes.type",
];

function mapLoose(raw: unknown, fallback: EventType): NormalizedEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const nameHint = pick(raw, NAME_PATHS) ?? pick(raw, EMAIL_PATHS)?.split("@")[0];
  return {
    type: mapType(pick(raw, TYPE_PATHS), fallback),
    displayName: firstName(nameHint),
    city: str(pick(raw, CITY_PATHS)),
    product: str(pick(raw, PRODUCT_PATHS)),
    dedupeKey: str(pick(raw, DEDUPE_PATHS)),
    occurredAt: dateOf(pick(raw, TIME_PATHS)),
  };
}

// The normalized shape used by the generic webhook / Zapier / Make connector.
function mapNormalized(raw: unknown): NormalizedEvent | null {
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
}

function connector(
  provider: IntegrationProvider,
  check: (ctx: VerifyContext) => boolean,
  mapToEvent: (raw: unknown) => NormalizedEvent | null,
): Connector {
  return {
    provider,
    verify: (ctx) => check(ctx) || verifyGeneric(ctx),
    mapToEvent,
  };
}

// Providers whose payload is one of the many common order/form shapes.
function looseProvider(provider: IntegrationProvider, fallback: EventType): Connector {
  return connector(
    provider,
    () => false,
    (raw) => mapLoose(raw, fallback),
  );
}

const registry: Record<IntegrationProvider, Connector> = {
  webhook: connector("webhook", () => false, mapNormalized),
  zapier: connector("zapier", () => false, mapNormalized),
  make: connector("make", () => false, mapNormalized),

  stripe: connector("stripe", verifyStripe, (raw) => mapLoose(raw, "purchase")),
  shopify: connector("shopify", bodyHmac(["x-shopify-hmac-sha256"], "base64"), (raw) =>
    mapLoose(raw, "purchase"),
  ),
  woocommerce: connector("woocommerce", bodyHmac(["x-wc-webhook-signature"], "base64"), (raw) =>
    mapLoose(raw, "purchase"),
  ),
  bigcommerce: connector("bigcommerce", bodyHmac(["x-bc-signature"], "hex"), (raw) =>
    mapLoose(raw, "purchase"),
  ),
  wix: connector("wix", bodyHmac(["x-wix-signature"], "base64"), (raw) =>
    mapLoose(raw, "purchase"),
  ),
  ecwid: connector("ecwid", bodyHmac(["x-ecwid-webhook-signature"], "base64"), (raw) =>
    mapLoose(raw, "purchase"),
  ),
  squarespace: looseProvider("squarespace", "purchase"),
  prestashop: looseProvider("prestashop", "purchase"),
  magento: looseProvider("magento", "purchase"),
  paddle: connector("paddle", verifyPaddle, (raw) => mapLoose(raw, "purchase")),
  lemonsqueezy: connector("lemonsqueezy", bodyHmac(["x-signature"], "hex"), (raw) =>
    mapLoose(raw, "purchase"),
  ),
  gumroad: looseProvider("gumroad", "purchase"),
  sendowl: looseProvider("sendowl", "purchase"),
  recharge: connector("recharge", bodyHmac(["x-recharge-hmac-sha256"], "base64"), (raw) =>
    mapLoose(raw, "purchase"),
  ),

  hubspot: connector("hubspot", verifyHubspot, (raw) => mapLoose(raw, "form_submit")),
  typeform: connector("typeform", bodyHmac(["typeform-signature"], "base64", "sha256="), (raw) =>
    mapLoose(raw, "form_submit"),
  ),
  jotform: looseProvider("jotform", "form_submit"),
  formspree: looseProvider("formspree", "form_submit"),
  calendly: connector("calendly", verifyCalendly, (raw) => mapLoose(raw, "signup")),

  kajabi: connector(
    "kajabi",
    bodyHmac(["x-kajabi-hmac-sha256", "x-kajabi-signature"], "base64"),
    (raw) => mapLoose(raw, "purchase"),
  ),
  teachable: looseProvider("teachable", "signup"),
  thinkific: connector("thinkific", bodyHmac(["x-thinkific-hmac-sha256"], "base64"), (raw) =>
    mapLoose(raw, "signup"),
  ),
  memberful: connector("memberful", bodyHmac(["x-memberful-webhook-signature"], "base64"), (raw) =>
    mapLoose(raw, "signup"),
  ),
  circle: looseProvider("circle", "signup"),

  convertkit: looseProvider("convertkit", "signup"),
  mailchimp: looseProvider("mailchimp", "signup"),
  activecampaign: looseProvider("activecampaign", "signup"),
  wordpress: looseProvider("wordpress", "form_submit"),
  webflow: looseProvider("webflow", "form_submit"),
};

export function getConnector(provider: string): Connector | null {
  return registry[provider as IntegrationProvider] ?? null;
}
