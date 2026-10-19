import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { IntegrationProvider } from "@repo/contracts/integrations";

// ---------------------------------------------------------------------------
// Outbound provider calls (FR-INT-04). This is the half of an integration that
// talks *to* the provider: verifying the credentials the user pasted, creating
// the webhook subscription on their behalf, and revoking it on disconnect.
// Everything here is best-effort and must never throw into the request path —
// each call returns a result the dashboard can show verbatim.
// ---------------------------------------------------------------------------

export type ProviderCredentials = Record<string, string>;

export type ServerCredentials = {
  // Tacto-level keys from the environment (not per-organization).
  shopify: { apiKey: string; apiSecret: string } | null;
  hubspot: { clientId: string; clientSecret: string } | null;
};

export type TestResult = { ok: boolean; message: string };
export type SubscribeResult = {
  ok: boolean;
  message: string;
  // Provider-side webhook id, stored so disconnect can revoke it.
  externalRef?: string;
  // Some providers mint the signing secret when the webhook is created
  // (Stripe, Calendly) — we store it so inbound signatures verify.
  secret?: string;
};

export type ProviderContext = {
  credentials: ProviderCredentials;
  server: ServerCredentials;
  // The public URL inbound deliveries should hit, already carrying ?site=.
  webhookUrl: string;
  secret?: string;
  externalRef?: string | null;
};

export type ProviderApi = {
  // Calls the provider to check the credentials are usable.
  test?: (ctx: ProviderContext) => Promise<TestResult>;
  // Registers the webhook with the provider.
  subscribe?: (ctx: ProviderContext) => Promise<SubscribeResult>;
  // Revokes a webhook Tacto registered.
  unsubscribe?: (ctx: ProviderContext) => Promise<void>;
};

const TIMEOUT_MS = 8_000;

type RequestOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

type HttpResult = { ok: boolean; status: number; json: unknown; text: string };

function privateIp(address: string): boolean {
  if (address.includes(":")) {
    const ip = address.toLowerCase();
    return ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80");
  }
  const [a, b] = address.split(".").map(Number);
  return (
    address === "0.0.0.0" ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && (b ?? 0) >= 16 && (b ?? 0) <= 31) ||
    (a === 192 && b === 168)
  );
}

// Blocks SSRF: only public HTTPS hosts may be called with customer credentials.
async function assertSafeUrl(value: string): Promise<void> {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("Provider URL must use HTTPS.");
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) {
    throw new Error("Provider URL must be public.");
  }
  if (isIP(host)) {
    if (privateIp(host)) throw new Error("Provider URL must be public.");
    return;
  }
  const resolved = await lookup(host, { all: true });
  if (resolved.length === 0 || resolved.some((entry) => privateIp(entry.address))) {
    throw new Error("Provider URL must resolve to a public address.");
  }
}

// Thin fetch wrapper: never throws, always reports something printable.
async function request(url: string, options: RequestOptions = {}): Promise<HttpResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    await assertSafeUrl(url);
    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers: options.headers,
      body: options.body,
      redirect: "manual",
      signal: controller.signal,
    });
    const text = await response.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { ok: response.ok, status: response.status, json, text };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "network error";
    return { ok: false, status: 0, json: null, text: reason };
  } finally {
    clearTimeout(timer);
  }
}

function readPath(value: unknown, path: string): unknown {
  let current: unknown = value;
  for (const key of path.split(".")) {
    if (Array.isArray(current)) {
      const index = Number(key);
      current = Number.isInteger(index) ? current[index] : undefined;
    } else if (current && typeof current === "object") {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return current;
}

function strAt(value: unknown, path: string): string | undefined {
  const found = readPath(value, path);
  return typeof found === "string" && found ? found : undefined;
}

// Turns a failed HTTP response into a short message safe to show in the UI.
function failure(label: string, result: HttpResult): TestResult {
  if (result.status === 0) return { ok: false, message: `${label} unreachable: ${result.text}` };
  const detail =
    strAt(result.json, "error.message") ??
    strAt(result.json, "message") ??
    strAt(result.json, "error") ??
    strAt(result.json, "errors.0.detail") ??
    strAt(result.json, "detail");
  const suffix = detail ? ` — ${detail}` : "";
  if (result.status === 401 || result.status === 403) {
    return { ok: false, message: `${label} rejected the credentials (${result.status})${suffix}` };
  }
  return { ok: false, message: `${label} returned ${result.status}${suffix}` };
}

function missing(fields: string[]): TestResult {
  return { ok: false, message: `Missing ${fields.join(", ")}.` };
}

function basicAuth(user: string, password: string): string {
  return `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

// ---------------------------------------------------------------------------
// Stripe — can both verify a restricted key and manage the endpoint itself.
// Creating the endpoint returns the signing secret, so the user never has to
// copy it by hand.
// ---------------------------------------------------------------------------
const STRIPE_EVENTS = [
  "checkout.session.completed",
  "payment_intent.succeeded",
  "invoice.paid",
  "customer.subscription.created",
];

const stripeApi: ProviderApi = {
  async test({ credentials }) {
    const apiKey = credentials.apiKey;
    if (!apiKey) {
      return {
        ok: false,
        message:
          "No Stripe API key stored. Paste a restricted key to let Tacto verify, or send a test webhook from Stripe instead.",
      };
    }
    const result = await request("https://api.stripe.com/v1/webhook_endpoints?limit=1", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!result.ok) return failure("Stripe", result);
    return { ok: true, message: "Stripe API key is valid." };
  },
  async subscribe({ credentials, webhookUrl }) {
    const apiKey = credentials.apiKey;
    if (!apiKey)
      return { ok: false, message: "A Stripe API key is required to register a webhook." };
    const body = new URLSearchParams({ url: webhookUrl, api_version: "2024-06-20" });
    for (const name of STRIPE_EVENTS) body.append("enabled_events[]", name);
    const result = await request("https://api.stripe.com/v1/webhook_endpoints", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
    if (!result.ok) return failure("Stripe", result);
    return {
      ok: true,
      message: "Stripe webhook endpoint created.",
      externalRef: strAt(result.json, "id"),
      secret: strAt(result.json, "secret"),
    };
  },
  async unsubscribe({ credentials, externalRef }) {
    if (!credentials.apiKey || !externalRef) return;
    await request(`https://api.stripe.com/v1/webhook_endpoints/${externalRef}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${credentials.apiKey}` },
    });
  },
};

// ---------------------------------------------------------------------------
// Shopify — Admin API token verifies against shop.json; webhooks are created
// through the Admin API and signed with the app's API secret key.
// ---------------------------------------------------------------------------
const SHOPIFY_VERSION = "2024-10";

function shopifyHost(credentials: ProviderCredentials): string | null {
  const raw = credentials.shopDomain?.trim().toLowerCase();
  if (!raw) return null;
  const host = raw.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return /^[a-z0-9-]+\.myshopify\.com$/.test(host) ? host : null;
}

const shopifyApi: ProviderApi = {
  async test({ credentials }) {
    const host = shopifyHost(credentials);
    const token = credentials.adminAccessToken;
    if (!host || !token) return missing(["shop domain", "admin access token"]);
    const result = await request(`https://${host}/admin/api/${SHOPIFY_VERSION}/shop.json`, {
      headers: { "X-Shopify-Access-Token": token },
    });
    if (!result.ok) return failure("Shopify", result);
    const name = strAt(result.json, "shop.name") ?? host;
    return { ok: true, message: `Connected to ${name}.` };
  },
  async subscribe({ credentials, webhookUrl }) {
    const host = shopifyHost(credentials);
    const token = credentials.adminAccessToken;
    if (!host || !token)
      return { ok: false, message: "Shop domain and access token are required." };
    const result = await request(`https://${host}/admin/api/${SHOPIFY_VERSION}/webhooks.json`, {
      method: "POST",
      headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
      body: JSON.stringify({
        webhook: { topic: "orders/create", address: webhookUrl, format: "json" },
      }),
    });
    if (!result.ok) return failure("Shopify", result);
    return {
      ok: true,
      message: "Shopify orders/create webhook registered.",
      externalRef: String(readPath(result.json, "webhook.id") ?? ""),
    };
  },
  async unsubscribe({ credentials, externalRef }) {
    const host = shopifyHost(credentials);
    if (!host || !credentials.adminAccessToken || !externalRef) return;
    await request(`https://${host}/admin/api/${SHOPIFY_VERSION}/webhooks/${externalRef}.json`, {
      method: "DELETE",
      headers: { "X-Shopify-Access-Token": credentials.adminAccessToken },
    });
  },
};

// ---------------------------------------------------------------------------
// WooCommerce — REST API keys over HTTPS basic auth.
// ---------------------------------------------------------------------------
const wooApi: ProviderApi = {
  async test({ credentials }) {
    const { storeUrl, consumerKey, consumerSecret } = credentials;
    if (!storeUrl || !consumerKey || !consumerSecret) {
      return missing(["store URL", "consumer key", "consumer secret"]);
    }
    const base = normalizeBaseUrl(storeUrl);
    const result = await request(`${base}/wp-json/wc/v3/system_status`, {
      headers: { Authorization: basicAuth(consumerKey, consumerSecret) },
    });
    if (!result.ok) return failure("WooCommerce", result);
    return { ok: true, message: "WooCommerce REST credentials are valid." };
  },
};

// ---------------------------------------------------------------------------
// HubSpot — private app token or OAuth access token.
// ---------------------------------------------------------------------------
const hubspotApi: ProviderApi = {
  async test({ credentials }) {
    const token = credentials.accessToken;
    if (!token) return missing(["private app access token"]);
    const result = await request("https://api.hubapi.com/account-info/v3/details", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!result.ok) return failure("HubSpot", result);
    const portal = readPath(result.json, "portalId");
    return { ok: true, message: `Connected to HubSpot portal ${portal ?? "account"}.` };
  },
};

const typeformApi: ProviderApi = {
  async test({ credentials }) {
    const token = credentials.accessToken;
    if (!token) {
      return {
        ok: false,
        message: "No Typeform token stored. Send a test response from Typeform instead.",
      };
    }
    const result = await request("https://api.typeform.com/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!result.ok) return failure("Typeform", result);
    const alias = strAt(result.json, "alias") ?? strAt(result.json, "email") ?? "account";
    return { ok: true, message: `Connected to Typeform (${alias}).` };
  },
};

// ---------------------------------------------------------------------------
// Calendly — PAT verifies against users/me; webhook subscriptions are created
// per organization and Calendly signs them with a key we supply.
// ---------------------------------------------------------------------------
const calendlyApi: ProviderApi = {
  async test({ credentials }) {
    const token = credentials.accessToken;
    if (!token) return missing(["personal access token"]);
    const result = await request("https://api.calendly.com/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!result.ok) return failure("Calendly", result);
    const name = strAt(result.json, "resource.name") ?? "account";
    return { ok: true, message: `Connected to Calendly (${name}).` };
  },
  async subscribe({ credentials, webhookUrl, secret }) {
    const token = credentials.accessToken;
    if (!token) return { ok: false, message: "A Calendly access token is required." };
    const me = await request("https://api.calendly.com/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!me.ok) return failure("Calendly", me);
    const organization = strAt(me.json, "resource.current_organization");
    if (!organization) return { ok: false, message: "Calendly did not return an organization." };
    const result = await request("https://api.calendly.com/webhook_subscriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        events: ["invitee.created"],
        organization,
        scope: "organization",
        ...(secret ? { signing_key: secret } : {}),
      }),
    });
    if (!result.ok) return failure("Calendly", result);
    return {
      ok: true,
      message: "Calendly invitee.created subscription created.",
      externalRef: strAt(result.json, "resource.uri"),
    };
  },
  async unsubscribe({ credentials, externalRef }) {
    if (!credentials.accessToken || !externalRef) return;
    // Calendly's externalRef is already a full resource URI.
    await request(externalRef, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${credentials.accessToken}` },
    });
  },
};

const paddleApi: ProviderApi = {
  async test({ credentials }) {
    const apiKey = credentials.apiKey;
    if (!apiKey) {
      return {
        ok: false,
        message: "No Paddle API key stored. Send a test notification from Paddle instead.",
      };
    }
    const result = await request("https://api.paddle.com/event-types", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!result.ok) return failure("Paddle", result);
    return { ok: true, message: "Paddle API key is valid." };
  },
};

const lemonApi: ProviderApi = {
  async test({ credentials }) {
    const apiKey = credentials.apiKey;
    if (!apiKey) {
      return {
        ok: false,
        message: "No Lemon Squeezy API key stored. Send a test webhook instead.",
      };
    }
    const result = await request("https://api.lemonsqueezy.com/v1/users/me", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/vnd.api+json",
      },
    });
    if (!result.ok) return failure("Lemon Squeezy", result);
    return { ok: true, message: "Lemon Squeezy API key is valid." };
  },
};

// Mailchimp keys carry their data center as a suffix: "<key>-us21".
const mailchimpApi: ProviderApi = {
  async test({ credentials }) {
    const apiKey = credentials.apiKey;
    if (!apiKey) return missing(["API key"]);
    const dc = apiKey.split("-")[1];
    if (!dc) {
      return {
        ok: false,
        message: "Mailchimp key is missing its data center suffix (e.g. -us21).",
      };
    }
    const result = await request(`https://${dc}.api.mailchimp.com/3.0/ping`, {
      headers: { Authorization: basicAuth("tacto", apiKey) },
    });
    if (!result.ok) return failure("Mailchimp", result);
    return { ok: true, message: "Mailchimp API key is valid." };
  },
};

const activeCampaignApi: ProviderApi = {
  async test({ credentials }) {
    const { accountUrl, apiToken } = credentials;
    if (!accountUrl || !apiToken) return missing(["account URL", "API token"]);
    const result = await request(`${normalizeBaseUrl(accountUrl)}/api/3/users/me`, {
      headers: { "Api-Token": apiToken },
    });
    if (!result.ok) return failure("ActiveCampaign", result);
    return { ok: true, message: "ActiveCampaign credentials are valid." };
  },
};

const registry: Partial<Record<IntegrationProvider, ProviderApi>> = {
  stripe: stripeApi,
  shopify: shopifyApi,
  woocommerce: wooApi,
  hubspot: hubspotApi,
  typeform: typeformApi,
  calendly: calendlyApi,
  paddle: paddleApi,
  lemonsqueezy: lemonApi,
  mailchimp: mailchimpApi,
  activecampaign: activeCampaignApi,
};

export function getProviderApi(provider: string): ProviderApi | null {
  return registry[provider as IntegrationProvider] ?? null;
}
