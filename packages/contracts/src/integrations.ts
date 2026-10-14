import { z } from "zod";
import { eventTypeSchema } from "./notifications";

export const integrationProviders = [
  "webhook",
  "zapier",
  "stripe",
  "shopify",
  "woocommerce",
] as const;
export const integrationProviderSchema = z.enum(integrationProviders);

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

export type IntegrationProvider = z.output<typeof integrationProviderSchema>;
export type IntegrationConfig = z.output<typeof integrationConfigSchema>;
export type CreateIntegrationInput = z.output<typeof createIntegrationSchema>;
export type Integration = z.output<typeof integrationSchema>;
export type WebhookEventInput = z.output<typeof webhookEventSchema>;
