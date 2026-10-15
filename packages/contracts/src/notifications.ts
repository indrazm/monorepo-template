import { z } from "zod";

export const notificationTypes = [
  "recent_sales",
  "counter",
  "live_visitors",
  "custom",
  "combo",
  "social_counter",
  "youtube",
  "low_stock",
  "countdown",
  // Conversion widgets (F69, "Boost"): popup modal, notification bar, spin-to-win.
  "popup",
  "bar",
  "spin_to_win",
] as const;
export const notificationTypeSchema = z.enum(notificationTypes);

export const eventTypes = ["purchase", "signup", "visit", "form_submit", "custom"] as const;
export const eventTypeSchema = z.enum(eventTypes);

const hexColorSchema = z.string().regex(/^#[0-9a-f]{6}$/i, "Expected a hex color like #3B82F6.");

// A localized variant of the message template (FR-NED-12). Keyed by locale
// (e.g. "id", "es", "pt-BR"); picked from the visitor's language when present.
export const notificationTranslationSchema = z.object({
  template: z.string().trim().min(1).max(280),
  fallbacks: z.record(z.string(), z.string()).default({}),
});

export const notificationMessageSchema = z.object({
  // e.g. "{{first_name}} from {{city}} just bought {{product}}"
  template: z.string().trim().min(1).max(280),
  fallbacks: z.record(z.string(), z.string()).default({}),
  hideTimeAgoAfterDays: z.number().int().positive().max(365).optional(),
  translations: z
    .record(z.string().trim().min(2).max(12), notificationTranslationSchema)
    .optional(),
});

export const notificationPositions = [
  "bottom-left",
  "bottom-right",
  "top-left",
  "top-right",
  // Conversion-widget positions (F69): full-width bars + a centered overlay.
  "top-bar",
  "bottom-bar",
  "center",
] as const;
export const notificationPositionSchema = z.enum(notificationPositions);

export const notificationStyleSchema = z.object({
  position: notificationPositionSchema,
  accent: hexColorSchema,
  shape: z.enum(["rounded", "square"]).default("rounded"),
  size: z.enum(["sm", "md"]).default("md"),
  animation: z.enum(["slide", "fade"]).default("slide"),
});

export const urlMatchModes = ["all", "simple", "contains", "regex"] as const;
export const urlMatchSchema = z
  .object({
    mode: z.enum(urlMatchModes),
    // Capped to limit the regex-targeting (ReDoS) surface; a path rule is short.
    value: z.string().trim().max(300).optional(),
  })
  .refine((rule) => rule.mode === "all" || (rule.value?.length ?? 0) > 0, {
    message: 'A match value is required unless the mode is "all".',
    path: ["value"],
  });

// Referrer targeting (FR-NED-07). A bare string is accepted for rows written
// before this rule had a mode, and is read as "contains".
export const referrerRuleSchema = z.preprocess(
  (value) => (typeof value === "string" ? { mode: "contains", value } : value),
  z
    .object({
      mode: z.enum(["any", "contains", "regex"]).default("any"),
      value: z.string().trim().max(300).optional(),
    })
    .refine((rule) => rule.mode === "any" || (rule.value?.length ?? 0) > 0, {
      message: "A referrer value is required for contains/regex.",
      path: ["value"],
    }),
);

// Visitor segmentation (FR-NED-07): first-ever visit vs a returning visitor,
// as reported by the pixel from its own stored visitor id.
export const visitorSegments = ["all", "new", "returning"] as const;
export const visitorSegmentSchema = z.enum(visitorSegments);

export const notificationDisplaySchema = z.object({
  url: urlMatchSchema,
  countries: z.array(z.string().length(2)).optional(),
  // Every listed param must be present on the landing URL with that value.
  utm: z.record(z.string(), z.string()).optional(),
  referrer: referrerRuleSchema.optional(),
  // Absent = "all"; kept optional so existing notifications stay valid.
  visitor: visitorSegmentSchema.optional(),
});

export const notificationDataSourceSchema = z.object({
  eventTypes: z.array(eventTypeSchema).default([]),
  filter: z.record(z.string(), z.unknown()).optional(),
});

export const notificationTimingSchema = z.object({
  delayMs: z.number().int().min(0).max(60_000).default(0),
  durationMs: z.number().int().min(1_000).max(60_000).default(5_000),
  intervalMs: z.number().int().min(0).max(120_000).default(8_000),
});

// Type-specific extras (FR-NOT-06/07): countdown target + low-stock number.
export const countdownConfigSchema = z.object({ endsAt: z.iso.datetime() });
export const fomoConfigSchema = z.object({ stock: z.number().int().min(0).max(1_000_000) });

// Media (FR-NED-03). The editor can pin an explicit image and choose which
// fallback source the server walks when an event carries no image:
// auto (image → map → gravatar → flag), a single source, or none.
export const mediaFallbacks = ["auto", "image", "map", "gravatar", "flag", "none"] as const;
export const notificationMediaSchema = z.object({
  imageUrl: z.string().trim().url().max(2048).optional(),
  fallback: z.enum(mediaFallbacks).default("auto"),
});
export type MediaFallback = (typeof mediaFallbacks)[number];

// Spin-to-win rewards (F69, PRD Fase 4). A conversion widget only earns its keep
// when it actually hands out something: each prize is a real label plus an
// optional coupon `code` or redemption `url`, drawn with a weighted probability.
export const spinPrizeSchema = z
  .object({
    label: z.string().trim().min(1).max(60),
    // A coupon code shown to the winner (copyable), and/or a link to redeem.
    code: z.string().trim().min(1).max(80).optional(),
    url: z.string().trim().url().max(2048).optional(),
    // Relative chance of this prize; "no prize" is expressed by a low weight.
    weight: z.number().int().min(1).max(100).default(1),
  })
  .refine((prize) => Boolean(prize.code || prize.url), {
    message: "A prize needs a code or a redemption URL.",
    path: ["code"],
  });

export const spinConfigSchema = z.object({
  // At least two outcomes, and one of them can be a low-value "try again".
  prizes: z.array(spinPrizeSchema).min(2).max(12),
  // How long the reward code/URL stays valid (shown as an expiry hint).
  validForDays: z.number().int().min(1).max(365).default(7),
});

// A/B testing (FR-ANL-04): each variant is an alternative message (and
// optionally style). Variants are shown deterministically per visitor by weight.
export const notificationVariantSchema = z.object({
  id: z.string().trim().min(1).max(40),
  weight: z.number().int().min(1).max(100).default(50),
  message: notificationMessageSchema,
  style: notificationStyleSchema.optional(),
});

export const notificationConfigSchema = z.object({
  message: notificationMessageSchema,
  style: notificationStyleSchema,
  display: notificationDisplaySchema,
  dataSource: notificationDataSourceSchema,
  timing: notificationTimingSchema,
  media: notificationMediaSchema.optional(),
  countdown: countdownConfigSchema.optional(),
  fomo: fomoConfigSchema.optional(),
  spin: spinConfigSchema.optional(),
  variants: z.array(notificationVariantSchema).min(2).max(6).optional(),
});

export const createNotificationSchema = z.object({
  siteId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(120).default("Untitled notification"),
  type: notificationTypeSchema,
  config: notificationConfigSchema,
  isActive: z.boolean().default(true),
});
export const updateNotificationSchema = createNotificationSchema.partial().omit({ siteId: true });

export const listNotificationsQuerySchema = z.object({
  siteId: z.string().trim().min(1),
});

export const notificationSchema = z.object({
  id: z.string(),
  siteId: z.string(),
  name: z.string(),
  type: notificationTypeSchema,
  config: notificationConfigSchema,
  verified: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
});

export type NotificationType = z.output<typeof notificationTypeSchema>;
export type EventType = z.output<typeof eventTypeSchema>;
export type NotificationMessage = z.output<typeof notificationMessageSchema>;
export type NotificationStyle = z.output<typeof notificationStyleSchema>;
export type NotificationDisplay = z.output<typeof notificationDisplaySchema>;
export type ReferrerRule = z.output<typeof referrerRuleSchema>;
export type VisitorSegment = z.output<typeof visitorSegmentSchema>;
export type NotificationDataSource = z.output<typeof notificationDataSourceSchema>;
export type NotificationTiming = z.output<typeof notificationTimingSchema>;
export type NotificationConfig = z.output<typeof notificationConfigSchema>;
export type NotificationVariant = z.output<typeof notificationVariantSchema>;
export type SpinConfig = z.output<typeof spinConfigSchema>;
export type SpinPrize = z.output<typeof spinPrizeSchema>;
export type NotificationMedia = z.output<typeof notificationMediaSchema>;
export type CreateNotificationInput = z.output<typeof createNotificationSchema>;
export type UpdateNotificationInput = z.output<typeof updateNotificationSchema>;
export type Notification = z.output<typeof notificationSchema>;
