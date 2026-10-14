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
] as const;
export const integrationProviderSchema = z.enum(integrationProviders);

export type IntegrationProvider = (typeof integrationProviders)[number];

// Per-provider metadata that drives the dashboard (labels, whether Tacto
// generates the signing secret or the user pastes the provider's own, and the
// signature header the connector verifies).
export type IntegrationMeta = {
  label: string;
  group: "Generic" | "E-commerce" | "Forms & CRM" | "Courses & members" | "Marketing & sites";
  // "generated": Tacto mints the secret; verify the `x-tacto-signature` header.
  // "pasted": paste the signing secret issued by the provider.
  secret: "generated" | "pasted";
  header: string;
};

export const integrationMeta: Record<IntegrationProvider, IntegrationMeta> = {
  webhook: {
    label: "Custom webhook",
    group: "Generic",
    secret: "generated",
    header: "x-tacto-signature (hex HMAC-SHA256)",
  },
  zapier: {
    label: "Zapier",
    group: "Generic",
    secret: "generated",
    header: "x-tacto-signature (hex HMAC-SHA256)",
  },
  make: {
    label: "Make",
    group: "Generic",
    secret: "generated",
    header: "x-tacto-signature (hex HMAC-SHA256)",
  },
  stripe: {
    label: "Stripe",
    group: "E-commerce",
    secret: "pasted",
    header: "Stripe-Signature (t + v1, hex HMAC-SHA256)",
  },
  shopify: {
    label: "Shopify",
    group: "E-commerce",
    secret: "pasted",
    header: "X-Shopify-Hmac-Sha256 (base64 HMAC-SHA256)",
  },
  woocommerce: {
    label: "WooCommerce",
    group: "E-commerce",
    secret: "pasted",
    header: "X-WC-Webhook-Signature (base64 HMAC-SHA256)",
  },
  bigcommerce: {
    label: "BigCommerce",
    group: "E-commerce",
    secret: "pasted",
    header: "X-BC-Signature (hex HMAC-SHA256)",
  },
  wix: {
    label: "Wix",
    group: "E-commerce",
    secret: "pasted",
    header: "X-Wix-Signature (base64 HMAC-SHA256)",
  },
  squarespace: {
    label: "Squarespace",
    group: "E-commerce",
    secret: "generated",
    header: "x-tacto-signature (hex HMAC-SHA256)",
  },
  ecwid: {
    label: "Ecwid",
    group: "E-commerce",
    secret: "pasted",
    header: "X-Ecwid-Webhook-Signature (base64 HMAC-SHA256)",
  },
  prestashop: {
    label: "PrestaShop",
    group: "E-commerce",
    secret: "generated",
    header: "x-tacto-signature (hex HMAC-SHA256)",
  },
  magento: {
    label: "Magento",
    group: "E-commerce",
    secret: "generated",
    header: "x-tacto-signature (hex HMAC-SHA256)",
  },
  paddle: {
    label: "Paddle",
    group: "E-commerce",
    secret: "pasted",
    header: "Paddle-Signature (ts + h1, hex HMAC-SHA256)",
  },
  lemonsqueezy: {
    label: "Lemon Squeezy",
    group: "E-commerce",
    secret: "pasted",
    header: "X-Signature (hex HMAC-SHA256)",
  },
  gumroad: {
    label: "Gumroad",
    group: "E-commerce",
    secret: "generated",
    header: "x-tacto-signature (hex HMAC-SHA256)",
  },
  sendowl: {
    label: "SendOwl",
    group: "E-commerce",
    secret: "generated",
    header: "x-tacto-signature (hex HMAC-SHA256)",
  },
  recharge: {
    label: "Recharge",
    group: "E-commerce",
    secret: "pasted",
    header: "X-Recharge-Hmac-Sha256 (base64 HMAC-SHA256)",
  },
  hubspot: {
    label: "HubSpot",
    group: "Forms & CRM",
    secret: "pasted",
    header: "X-HubSpot-Signature (hex SHA256 of secret+body)",
  },
  typeform: {
    label: "Typeform",
    group: "Forms & CRM",
    secret: "pasted",
    header: "Typeform-Signature (base64 HMAC-SHA256)",
  },
  jotform: {
    label: "Jotform",
    group: "Forms & CRM",
    secret: "generated",
    header: "x-tacto-signature (hex HMAC-SHA256)",
  },
  formspree: {
    label: "Formspree",
    group: "Forms & CRM",
    secret: "generated",
    header: "x-tacto-signature (hex HMAC-SHA256)",
  },
  calendly: {
    label: "Calendly",
    group: "Forms & CRM",
    secret: "pasted",
    header: "Calendly-Webhook-Signature (t + v1, base64 HMAC-SHA256)",
  },
  kajabi: {
    label: "Kajabi",
    group: "Courses & members",
    secret: "pasted",
    header: "X-Kajabi-Hmac-SHA256 (base64 HMAC-SHA256)",
  },
  teachable: {
    label: "Teachable",
    group: "Courses & members",
    secret: "generated",
    header: "x-tacto-signature (hex HMAC-SHA256)",
  },
  thinkific: {
    label: "Thinkific",
    group: "Courses & members",
    secret: "pasted",
    header: "X-Thinkific-Hmac-Sha256 (base64 HMAC-SHA256)",
  },
  memberful: {
    label: "Memberful",
    group: "Courses & members",
    secret: "pasted",
    header: "X-Memberful-Webhook-Signature (base64 HMAC-SHA256)",
  },
  circle: {
    label: "Circle",
    group: "Courses & members",
    secret: "generated",
    header: "x-tacto-signature (hex HMAC-SHA256)",
  },
  convertkit: {
    label: "Kit (ConvertKit)",
    group: "Marketing & sites",
    secret: "generated",
    header: "x-tacto-signature (hex HMAC-SHA256)",
  },
  mailchimp: {
    label: "Mailchimp",
    group: "Marketing & sites",
    secret: "generated",
    header: "x-tacto-signature (hex HMAC-SHA256)",
  },
  activecampaign: {
    label: "ActiveCampaign",
    group: "Marketing & sites",
    secret: "generated",
    header: "x-tacto-signature (hex HMAC-SHA256)",
  },
  wordpress: {
    label: "WordPress",
    group: "Marketing & sites",
    secret: "generated",
    header: "x-tacto-signature (hex HMAC-SHA256)",
  },
  webflow: {
    label: "Webflow",
    group: "Marketing & sites",
    secret: "generated",
    header: "x-tacto-signature (hex HMAC-SHA256)",
  },
};

// Optional data filter (FR-INT-03): only accept events whose raw payload has
// `path` (dot notation) equal to `equals`. Skips everything else.
export const integrationFilterSchema = z.object({
  path: z.string().trim().min(1).max(120),
  equals: z.string().trim().max(200),
});

// Stored config for an integration (jsonb). `secret` verifies inbound webhooks.
export const integrationConfigSchema = z.object({
  secret: z.string().trim().min(8).optional(),
  label: z.string().trim().max(120).optional(),
  filter: integrationFilterSchema.optional(),
});
export type IntegrationFilter = z.output<typeof integrationFilterSchema>;

export const createIntegrationSchema = z.object({
  provider: integrationProviderSchema,
  config: integrationConfigSchema.default({}),
});

export const integrationSchema = z.object({
  id: z.string(),
  provider: integrationProviderSchema,
  status: z.string(),
  config: integrationConfigSchema,
  createdAt: z.iso.datetime(),
});

// The generic payload a custom webhook / Zapier sends to create an event.
export const webhookEventSchema = z.object({
  type: eventTypeSchema.default("custom"),
  name: z.string().trim().max(120).optional(),
  city: z.string().trim().max(120).optional(),
  product: z.string().trim().max(160).optional(),
  dedupeKey: z.string().trim().max(200).optional(),
  occurredAt: z.iso.datetime().optional(),
});

export type IntegrationConfig = z.output<typeof integrationConfigSchema>;
export type CreateIntegrationInput = z.output<typeof createIntegrationSchema>;
export type Integration = z.output<typeof integrationSchema>;
export type WebhookEventInput = z.output<typeof webhookEventSchema>;
