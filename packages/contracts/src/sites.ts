import { z } from "zod";

// A registered domain, e.g. "shop.example.com" (no scheme, no path).
const domainSchema = z
  .string()
  .trim()
  .min(3)
  .max(253)
  .regex(/^[a-z0-9.-]+$/i, "Enter a bare domain like shop.example.com (no http, no path).");

export const createSiteSchema = z.object({
  name: z.string().trim().min(1).max(120),
  domain: domainSchema,
});
export const updateSiteSchema = createSiteSchema.partial();

export const siteSchema = z.object({
  id: z.string(),
  name: z.string(),
  domain: z.string(),
  siteKey: z.string(),
  // Secret key for server-to-server ingestion. Returned only to the site's
  // owning organization over authenticated requests (never in the pixel).
  apiKey: z.string(),
  pixelVerifiedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export const sitesResponseSchema = z.object({ sites: z.array(siteSchema) });

// Per-domain settings (domain_setting table).
export const domainLoopSettingsSchema = z.object({
  loopAfter: z.number().int().min(0).max(50).default(3),
  order: z.enum(["random", "manual"]).default("random"),
  manualOrder: z.array(z.string()).default([]),
  showClose: z.boolean().default(true),
  closeForDays: z.number().int().min(0).max(365).default(1),
});
export const domainPrivacySchema = z.object({
  requireConsent: z.boolean().default(false),
  trackIpGeo: z.boolean().default(true),
  storeEmail: z.boolean().default(false),
  // Anti-abuse (FR-NGS-07): IPs that never receive notifications, and an
  // optional profanity mask on rendered text.
  blockedIps: z.array(z.string().trim().min(1).max(64)).max(200).default([]),
  filterProfanity: z.boolean().default(false),
});
// Forward widget view/click to the host page's analytics (FR-NGS-06). Uses the
// tags already on the customer's site — no server-side keys.
export const analyticsPassthroughSchema = z.object({
  gtag: z.boolean().default(false), // Google Analytics / GA4 via gtag()
  dataLayer: z.boolean().default(false), // Google Tag Manager dataLayer.push
  fbq: z.boolean().default(false), // Facebook Pixel
  mixpanel: z.boolean().default(false),
});
export const domainSettingSchema = z.object({
  loop: domainLoopSettingsSchema,
  privacy: domainPrivacySchema,
  customCss: z.string().max(20_000).nullable().default(null),
  analyticsPassthrough: analyticsPassthroughSchema,
});
export const updateDomainSettingSchema = domainSettingSchema.partial();

export type AnalyticsPassthrough = z.output<typeof analyticsPassthroughSchema>;

export type CreateSiteInput = z.output<typeof createSiteSchema>;
export type UpdateSiteInput = z.output<typeof updateSiteSchema>;
export type Site = z.output<typeof siteSchema>;
export type DomainLoopSettings = z.output<typeof domainLoopSettingsSchema>;
export type DomainPrivacy = z.output<typeof domainPrivacySchema>;
export type DomainSetting = z.output<typeof domainSettingSchema>;
