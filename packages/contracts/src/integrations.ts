import { z } from "zod";
import { eventTypeSchema } from "./notifications";

export const integrationProviders = [
  // Generic / automation
  "webhook",
  "zapier",
  "make",
  // E-commerce & payments
  "stripe",
  "shopify",
  "woocommerce",
  "bigcommerce",
  "wix",
  "squarespace",
  "ecwid",
  "prestashop",
  "magento",
  "paddle",
  "lemonsqueezy",
  "gumroad",
  "sendowl",
  "recharge",
  // CRM, forms & scheduling
  "hubspot",
  "typeform",
  "jotform",
  "formspree",
  "calendly",
  // Courses, communities & memberships
  "kajabi",
  "teachable",
  "thinkific",
  "memberful",
  "circle",
  // Email / marketing / site builders
  "convertkit",
  "mailchimp",
  "activecampaign",
  "wordpress",
  "webflow",
  // CRM, support, spreadsheets & accounting
  "salesforce",
  "pipedrive",
  "zoho",
  "airtable",
  "google_sheets",
  "intercom",
  "crisp",
  "drift",
  "tawk_to",
  "livechat",
  "quickbooks",
  "xero",
] as const;
export const integrationProviderSchema = z.enum(integrationProviders);

export type IntegrationProvider = (typeof integrationProviders)[number];

// ---------------------------------------------------------------------------
// Connection model (FR-INT-01). A provider is connected through exactly one of
// these flows, and the dashboard renders a different wizard for each:
//
// - "generated_secret": the provider (or Zapier/Make/your server) POSTs to our
//   webhook URL and signs the body with a secret Tacto mints.
// - "webhook_secret":   the provider signs with its own secret, which the user
//   copies out of the provider's dashboard and pastes here.
// - "api_key":          the user pastes provider API credentials; Tacto calls
//   the provider to verify them and (where supported) registers the webhook.
// - "oauth":            the user authorizes Tacto on the provider; Tacto stores
//   the access token and registers the webhook on their behalf.
// ---------------------------------------------------------------------------
export const integrationAuthKinds = [
  "generated_secret",
  "webhook_secret",
  "api_key",
  "oauth",
] as const;
export const integrationAuthSchema = z.enum(integrationAuthKinds);
export type IntegrationAuthKind = (typeof integrationAuthKinds)[number];

// Lifecycle of a connection (FR-INT-04). "pending" means credentials are
// stored but nothing has proven the connection works yet.
export const integrationStatuses = ["pending", "connected", "error", "disabled"] as const;
export const integrationStatusSchema = z.enum(integrationStatuses);
export type IntegrationStatus = (typeof integrationStatuses)[number];

// One credential a provider needs. Values of kind "secret" are stored
// encrypted and never returned by the API.
export type IntegrationCredentialField = {
  key: string;
  label: string;
  kind: "secret" | "text" | "url";
  placeholder?: string;
  help?: string;
  optional?: boolean;
};

export type IntegrationMeta = {
  label: string;
  group: "Generic" | "E-commerce" | "Forms & CRM" | "Courses & members" | "Marketing & sites";
  auth: IntegrationAuthKind;
  // The signature header/scheme the connector verifies on inbound webhooks.
  header: string;
  // Credentials the user provides for api_key/oauth/poll providers (and the
  // optional API key some webhook providers accept so "Verify" can call them).
  credentials?: IntegrationCredentialField[];
  // Link to the provider's own setup documentation.
  docsUrl?: string;
  // True when Tacto can create/delete the webhook through the provider's API.
  managesWebhook?: boolean;
  // True when "Verify" can actively call the provider instead of waiting for
  // the first signed delivery.
  canTest?: boolean;
};

const TACTO_HEADER = "x-tacto-signature (hex HMAC-SHA256)";

// Shorthand for providers that cannot sign a webhook we verify natively and
// are therefore forwarded through Zapier/Make or a small script.
function forwarded(
  label: string,
  group: IntegrationMeta["group"],
  docsUrl?: string,
): IntegrationMeta {
  return { label, group, auth: "generated_secret", header: TACTO_HEADER, docsUrl };
}

export const integrationMeta: Record<IntegrationProvider, IntegrationMeta> = {
  webhook: {
    label: "Custom webhook",
    group: "Generic",
    auth: "generated_secret",
    header: TACTO_HEADER,
  },
  zapier: {
    label: "Zapier",
    group: "Generic",
    auth: "generated_secret",
    header: TACTO_HEADER,
    docsUrl: "https://zapier.com/apps/webhook/integrations",
  },
  make: {
    label: "Make",
    group: "Generic",
    auth: "generated_secret",
    header: TACTO_HEADER,
    docsUrl: "https://www.make.com/en/help/tools/http",
  },

  stripe: {
    label: "Stripe",
    group: "E-commerce",
    auth: "webhook_secret",
    header: "Stripe-Signature (t + v1, hex HMAC-SHA256)",
    docsUrl: "https://dashboard.stripe.com/webhooks",
    canTest: true,
    managesWebhook: true,
    credentials: [
      {
        key: "apiKey",
        label: "Restricted API key",
        kind: "secret",
        placeholder: "rk_live_...",
        help: "Optional. With write access to Webhook Endpoints, Tacto can register the webhook for you and verify the connection.",
        optional: true,
      },
    ],
  },
  shopify: {
    label: "Shopify",
    group: "E-commerce",
    auth: "api_key",
    header: "X-Shopify-Hmac-Sha256 (base64 HMAC-SHA256)",
    docsUrl: "https://shopify.dev/docs/apps/build/webhooks",
    canTest: true,
    managesWebhook: true,
    credentials: [
      {
        key: "shopDomain",
        label: "Shop domain",
        kind: "text",
        placeholder: "your-store.myshopify.com",
      },
      {
        key: "adminAccessToken",
        label: "Admin API access token",
        kind: "secret",
        placeholder: "shpat_...",
        help: "Custom app -> API credentials. Scope needed: read_orders.",
      },
    ],
  },
  woocommerce: {
    label: "WooCommerce",
    group: "E-commerce",
    auth: "api_key",
    header: "X-WC-Webhook-Signature (base64 HMAC-SHA256)",
    docsUrl: "https://woocommerce.com/document/webhooks/",
    canTest: true,
    credentials: [
      { key: "storeUrl", label: "Store URL", kind: "url", placeholder: "https://shop.example.com" },
      { key: "consumerKey", label: "Consumer key", kind: "secret", placeholder: "ck_..." },
      { key: "consumerSecret", label: "Consumer secret", kind: "secret", placeholder: "cs_..." },
    ],
  },
  bigcommerce: {
    label: "BigCommerce",
    group: "E-commerce",
    auth: "webhook_secret",
    header: "X-BC-Signature (hex HMAC-SHA256)",
    docsUrl: "https://developer.bigcommerce.com/docs/integrations/webhooks",
  },
  wix: {
    label: "Wix",
    group: "E-commerce",
    auth: "webhook_secret",
    header: "X-Wix-Signature (base64 HMAC-SHA256)",
    docsUrl: "https://dev.wix.com/docs/rest/articles/getting-started/webhooks",
  },
  squarespace: forwarded("Squarespace", "E-commerce"),
  ecwid: {
    label: "Ecwid",
    group: "E-commerce",
    auth: "webhook_secret",
    header: "X-Ecwid-Webhook-Signature (base64 HMAC-SHA256)",
    docsUrl: "https://api-docs.ecwid.com/reference/webhooks",
  },
  prestashop: forwarded("PrestaShop", "E-commerce"),
  magento: forwarded("Magento", "E-commerce"),
  paddle: {
    label: "Paddle",
    group: "E-commerce",
    auth: "webhook_secret",
    header: "Paddle-Signature (ts + h1, hex HMAC-SHA256)",
    docsUrl: "https://developer.paddle.com/webhooks/overview",
    canTest: true,
    credentials: [
      {
        key: "apiKey",
        label: "API key",
        kind: "secret",
        placeholder: "pdl_live_...",
        help: "Optional - lets Tacto verify the connection against Paddle's API.",
        optional: true,
      },
    ],
  },
  lemonsqueezy: {
    label: "Lemon Squeezy",
    group: "E-commerce",
    auth: "webhook_secret",
    header: "X-Signature (hex HMAC-SHA256)",
    docsUrl: "https://docs.lemonsqueezy.com/help/webhooks",
    canTest: true,
    credentials: [
      {
        key: "apiKey",
        label: "API key",
        kind: "secret",
        help: "Optional - lets Tacto verify the connection.",
        optional: true,
      },
    ],
  },
  gumroad: forwarded("Gumroad", "E-commerce", "https://help.gumroad.com/article/280-ping"),
  sendowl: forwarded("SendOwl", "E-commerce"),
  recharge: {
    label: "Recharge",
    group: "E-commerce",
    auth: "webhook_secret",
    header: "X-Recharge-Hmac-Sha256 (base64 HMAC-SHA256)",
    docsUrl: "https://developer.rechargepayments.com/v1/webhooks",
  },

  hubspot: {
    label: "HubSpot",
    group: "Forms & CRM",
    auth: "oauth",
    header: "X-HubSpot-Signature (hex SHA256 of secret+body)",
    docsUrl: "https://developers.hubspot.com/docs/api/webhooks",
    canTest: true,
    credentials: [
      {
        key: "accessToken",
        label: "Private app access token",
        kind: "secret",
        placeholder: "pat-...",
        help: "Use a private app token, or click Authorize to connect with OAuth.",
        optional: true,
      },
    ],
  },
  typeform: {
    label: "Typeform",
    group: "Forms & CRM",
    auth: "webhook_secret",
    header: "Typeform-Signature (base64 HMAC-SHA256)",
    docsUrl: "https://www.typeform.com/developers/webhooks/",
    canTest: true,
    credentials: [
      {
        key: "accessToken",
        label: "Personal access token",
        kind: "secret",
        help: "Optional - lets Tacto verify the connection and list your forms.",
        optional: true,
      },
    ],
  },
  jotform: forwarded(
    "Jotform",
    "Forms & CRM",
    "https://www.jotform.com/help/245-how-to-setup-a-webhook-with-jotform/",
  ),
  formspree: forwarded("Formspree", "Forms & CRM"),
  calendly: {
    label: "Calendly",
    group: "Forms & CRM",
    auth: "api_key",
    header: "Calendly-Webhook-Signature (t + v1, base64 HMAC-SHA256)",
    docsUrl: "https://developer.calendly.com/api-docs",
    canTest: true,
    managesWebhook: true,
    credentials: [
      {
        key: "accessToken",
        label: "Personal access token",
        kind: "secret",
        help: "Calendly -> Integrations -> API & webhooks -> Personal access token.",
      },
    ],
  },

  kajabi: {
    label: "Kajabi",
    group: "Courses & members",
    auth: "webhook_secret",
    header: "X-Kajabi-Hmac-SHA256 (base64 HMAC-SHA256)",
  },
  teachable: forwarded("Teachable", "Courses & members"),
  thinkific: {
    label: "Thinkific",
    group: "Courses & members",
    auth: "webhook_secret",
    header: "X-Thinkific-Hmac-Sha256 (base64 HMAC-SHA256)",
    docsUrl: "https://developers.thinkific.com/api/webhooks/",
  },
  memberful: {
    label: "Memberful",
    group: "Courses & members",
    auth: "webhook_secret",
    header: "X-Memberful-Webhook-Signature (base64 HMAC-SHA256)",
    docsUrl: "https://memberful.com/help/custom-development-and-integrations/webhooks/",
  },
  circle: forwarded("Circle", "Courses & members"),

  convertkit: forwarded("Kit (ConvertKit)", "Marketing & sites"),
  mailchimp: {
    label: "Mailchimp",
    group: "Marketing & sites",
    auth: "api_key",
    header: TACTO_HEADER,
    docsUrl: "https://mailchimp.com/developer/marketing/guides/sync-audience-data-webhooks/",
    canTest: true,
    credentials: [
      {
        key: "apiKey",
        label: "API key",
        kind: "secret",
        placeholder: "...-us21",
        help: "The data center suffix (e.g. us21) tells Tacto which API host to call.",
      },
    ],
  },
  activecampaign: {
    label: "ActiveCampaign",
    group: "Marketing & sites",
    auth: "api_key",
    header: TACTO_HEADER,
    docsUrl: "https://developers.activecampaign.com/reference/webhooks",
    canTest: true,
    credentials: [
      {
        key: "accountUrl",
        label: "Account URL",
        kind: "url",
        placeholder: "https://youraccount.api-us1.com",
      },
      { key: "apiToken", label: "API token", kind: "secret" },
    ],
  },
  wordpress: forwarded("WordPress", "Marketing & sites"),
  webflow: forwarded(
    "Webflow",
    "Marketing & sites",
    "https://developers.webflow.com/data/docs/working-with-webhooks",
  ),

  salesforce: forwarded("Salesforce", "Forms & CRM"),
  pipedrive: forwarded("Pipedrive", "Forms & CRM"),
  zoho: forwarded("Zoho CRM", "Forms & CRM"),
  airtable: forwarded("Airtable", "Forms & CRM"),
  google_sheets: forwarded("Google Sheets", "Forms & CRM"),
  intercom: forwarded("Intercom", "Forms & CRM"),
  crisp: forwarded("Crisp", "Forms & CRM"),
  drift: forwarded("Drift", "Forms & CRM"),
  tawk_to: forwarded("Tawk.to", "Forms & CRM"),
  livechat: forwarded("LiveChat", "Forms & CRM"),
  quickbooks: forwarded("QuickBooks", "E-commerce"),
  xero: forwarded("Xero", "E-commerce"),
};

// ---------------------------------------------------------------------------
// Field mapping (FR-INT-03). Dot-notation JSON paths into the provider payload.
// Any field left blank falls back to the connector's built-in heuristics.
// ---------------------------------------------------------------------------
const pathSchema = z.string().trim().max(160);
export const integrationMappingSchema = z.object({
  type: pathSchema.optional(),
  name: pathSchema.optional(),
  city: pathSchema.optional(),
  product: pathSchema.optional(),
  dedupeKey: pathSchema.optional(),
  occurredAt: pathSchema.optional(),
});
export type IntegrationMapping = z.output<typeof integrationMappingSchema>;

export const integrationMappingFields = [
  { key: "type", label: "Event type", help: "purchase / signup / form_submit" },
  { key: "name", label: "Customer name", help: "Only the first name is stored" },
  { key: "city", label: "City" },
  { key: "product", label: "Product / plan" },
  { key: "dedupeKey", label: "Unique id", help: "Used to reject duplicate deliveries" },
  { key: "occurredAt", label: "Timestamp" },
] as const;

// Optional data filter (FR-INT-03): only accept events whose raw payload has
// `path` (dot notation) equal to `equals`. Skips everything else.
export const integrationFilterSchema = z.object({
  path: z.string().trim().min(1).max(120),
  equals: z.string().trim().max(200),
});
export type IntegrationFilter = z.output<typeof integrationFilterSchema>;

// Stored config (jsonb). `secret` verifies inbound webhooks; `credentials`
// holds provider API credentials and is encrypted at rest + never returned.
export const integrationConfigSchema = z.object({
  secret: z.string().trim().min(8).optional(),
  label: z.string().trim().max(120).optional(),
  // Which site inbound events are attributed to (site key).
  siteKey: z.string().trim().max(64).optional(),
  filter: integrationFilterSchema.optional(),
  mapping: integrationMappingSchema.optional(),
  // Event types this integration may create (empty/absent = all).
  events: z.array(eventTypeSchema).max(6).optional(),
  credentials: z.record(z.string(), z.string().max(4000)).optional(),
});
export type IntegrationConfig = z.output<typeof integrationConfigSchema>;

export const createIntegrationSchema = z.object({
  provider: integrationProviderSchema,
  config: integrationConfigSchema.default({}),
});
export type CreateIntegrationInput = z.output<typeof createIntegrationSchema>;

// A connect wizard patches the config step by step.
export const updateIntegrationSchema = z.object({
  config: integrationConfigSchema.partial().optional(),
  status: z.enum(["connected", "disabled"]).optional(),
});
export type UpdateIntegrationInput = z.output<typeof updateIntegrationSchema>;

// What the API returns. Credentials are reduced to the list of keys that are
// set, so the dashboard can show "configured" without exposing the values.
export const integrationSchema = z.object({
  id: z.string(),
  provider: integrationProviderSchema,
  status: integrationStatusSchema,
  config: integrationConfigSchema.omit({ credentials: true }),
  credentialKeys: z.array(z.string()),
  // Connection health (FR-INT-04).
  lastCheckedAt: z.iso.datetime().nullable(),
  lastEventAt: z.iso.datetime().nullable(),
  lastError: z.string().nullable(),
  // Provider-side webhook id, when Tacto registered it.
  externalRef: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type Integration = z.output<typeof integrationSchema>;

export const verifyIntegrationResponseSchema = z.object({
  status: integrationStatusSchema,
  message: z.string(),
  checkedAt: z.iso.datetime(),
});
export type VerifyIntegrationResponse = z.output<typeof verifyIntegrationResponseSchema>;

// The generic payload a custom webhook / Zapier sends to create an event.
export const webhookEventSchema = z.object({
  type: eventTypeSchema.default("custom"),
  name: z.string().trim().max(120).optional(),
  city: z.string().trim().max(120).optional(),
  product: z.string().trim().max(160).optional(),
  dedupeKey: z.string().trim().max(200).optional(),
  occurredAt: z.iso.datetime().optional(),
});
export type WebhookEventInput = z.output<typeof webhookEventSchema>;

// ---------------------------------------------------------------------------
// Connect wizard (FR-INT-01/02). Real multi-step instructions per auth kind,
// so the dashboard walks the user through the provider's own UI instead of
// just showing one secret field.
// ---------------------------------------------------------------------------
export type IntegrationMode = "direct" | "automation" | "api" | "poll";

export type IntegrationStep = {
  id: string;
  title: string;
  detail: string;
  // What happens here: read instructions, copy a value out of Tacto, fill in
  // credentials, run the connection test, or map fields. Drives the controls
  // the wizard step renders.
  action: "read" | "copy_url" | "copy_secret" | "credentials" | "verify" | "mapping";
};

export type IntegrationGuide = {
  mode: IntegrationMode;
  signature: string;
  steps: IntegrationStep[];
};

export function integrationGuide(provider: IntegrationProvider): IntegrationGuide {
  const meta = integrationMeta[provider];
  const name = meta.label;

  if (meta.auth === "api_key" || meta.auth === "oauth") {
    return {
      mode: "api",
      signature: meta.header,
      steps: [
        {
          id: "credentials",
          title: `Authorize ${name}`,
          detail:
            meta.auth === "oauth"
              ? `Authorize Tacto on ${name}, or paste a private app token below.`
              : `Create API credentials in ${name} and paste them below.`,
          action: "credentials",
        },
        {
          id: "verify",
          title: "Verify the connection",
          detail: `Tacto calls ${name} with these credentials and reports whether they work.`,
          action: "verify",
        },
        {
          id: "webhook",
          title: meta.managesWebhook ? "Register the webhook" : "Add the webhook",
          detail: meta.managesWebhook
            ? `Tacto registers the webhook on ${name} for you and verifies ${meta.header}.`
            : `Add a webhook in ${name} pointing at the URL below; Tacto verifies ${meta.header}.`,
          action: "copy_url",
        },
        {
          id: "events",
          title: "Pick events and map fields",
          detail:
            "Choose which event types to accept and, if the payload is unusual, map its JSON paths onto name / city / product.",
          action: "mapping",
        },
      ],
    };
  }

  if (meta.auth === "webhook_secret") {
    return {
      mode: "direct",
      signature: meta.header,
      steps: [
        {
          id: "endpoint",
          title: `Add the endpoint in ${name}`,
          detail: `Open ${name}'s webhook settings and add an endpoint pointing at the URL below.`,
          action: "copy_url",
        },
        {
          id: "events",
          title: "Subscribe to the right events",
          detail:
            "Select the events you want to show as social proof - orders / payments, sign-ups, form responses.",
          action: "read",
        },
        {
          id: "credentials",
          title: "Paste the signing secret",
          detail: `${name} shows a signing secret after you create the endpoint. Paste it here so Tacto can verify ${meta.header}.`,
          action: "credentials",
        },
        {
          id: "verify",
          title: "Verify the connection",
          detail:
            "Send a test event from the provider (or click Verify) - Tacto confirms the signature and shows the first event it received.",
          action: "verify",
        },
      ],
    };
  }

  // generated_secret: either our own custom webhook, or a provider we have to
  // reach through Zapier / Make because it cannot sign a request we can verify.
  const viaAutomation = provider !== "webhook";
  return {
    mode: viaAutomation ? "automation" : "direct",
    signature: meta.header,
    steps: [
      {
        id: "endpoint",
        title: viaAutomation ? `Create a Zap / scenario for ${name}` : "Copy your webhook URL",
        detail: viaAutomation
          ? `${name} cannot sign a webhook Tacto can verify, so forward its events through Zapier / Make (or your own server) with a "Webhooks -> POST" action to the URL below.`
          : "POST your events to this URL from your own backend.",
        action: "copy_url",
      },
      {
        id: "secret",
        title: "Sign the request",
        detail:
          "Set the header x-tacto-signature to the hex HMAC-SHA256 of the raw request body, keyed with the secret below.",
        action: "copy_secret",
      },
      {
        id: "events",
        title: "Map the body",
        detail:
          "Send JSON with: type, name, city, product, dedupeKey, occurredAt. dedupeKey makes retries safe.",
        action: "mapping",
      },
      {
        id: "verify",
        title: "Send a test event",
        detail:
          "Trigger the Zap / run your script once. Tacto marks the integration connected as soon as a correctly signed event arrives.",
        action: "verify",
      },
    ],
  };
}
