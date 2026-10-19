import { z } from "zod";

export const notificationTypes = [
  "recent_sales",
  "counter",
  "live_visitors",
  "custom",
  "combo",
  "social_counter",
  "youtube",
  // Social proof from customer reviews (PRD "Should"): a star rating + quote.
  "review",
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

// Only http(s) URLs may reach browser sinks (href/src/window.open). Plain
// `z.url()` also accepts `javascript:`, `data:` and `vbscript:`, which would
// execute in the customer's page when a notification is clicked or rendered.
const httpUrlSchema = z
  .string()
  .trim()
  .url()
  .max(2048)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }, "Use an http(s) URL.");

// A localized variant of the message template (FR-NED-12). Keyed by locale
// (e.g. "id", "es", "pt-BR"); picked from the visitor's language when present.
export const notificationTranslationSchema = z.object({
  template: z.string().trim().min(1).max(280),
  fallbacks: z.record(z.string(), z.string()).default({}),
});

// Per-variable text transform applied to substituted values (feedback T9):
// tidy raw data ("  jane " → "Jane", "NYC" → "nyc"/"NYC") before display.
export const textTransforms = ["none", "trim", "capitalize", "uppercase", "lowercase"] as const;
export const textTransformSchema = z.enum(textTransforms);
export type TextTransform = z.output<typeof textTransformSchema>;

export const notificationMessageSchema = z.object({
  // e.g. "{{first_name}} from {{city}} just bought {{product}}"
  template: z.string().trim().min(1).max(280),
  fallbacks: z.record(z.string(), z.string()).default({}),
  // Optional per-variable transforms, keyed by variable name (e.g. first_name).
  transforms: z.record(z.string(), textTransformSchema).optional(),
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

// Richer styling (feedback T9): an added "lg" size, "scale"/"none" animations,
// a font family, and an optional click action (open a URL on click).
export const notificationFonts = ["system", "rounded", "serif", "mono"] as const;
export const notificationFontSchema = z.enum(notificationFonts);
export const clickActionSchema = z
  .object({
    type: z.enum(["none", "url"]).default("none"),
    url: httpUrlSchema.optional(),
    newTab: z.boolean().default(true),
  })
  .refine((action) => action.type !== "url" || Boolean(action.url), {
    message: "A URL is required when the click action opens a link.",
    path: ["url"],
  });
export const notificationStyleSchema = z.object({
  position: notificationPositionSchema,
  accent: hexColorSchema,
  shape: z.enum(["rounded", "square"]).default("rounded"),
  size: z.enum(["sm", "md", "lg"]).default("md"),
  animation: z.enum(["slide", "fade", "scale", "none"]).default("slide"),
  font: notificationFontSchema.optional(),
  clickAction: clickActionSchema.optional(),
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

// Per-notification data source (FR-NED-08): which events feed this
// notification. Beyond the event type(s), an optional provider `source` and a
// small set of payload `filters` let two notifications on the same site react
// to different slices of the same stream (e.g. only Stripe purchases over $50).
export const dataSourceFilterOps = ["eq", "contains", "gte", "lte"] as const;
export const dataSourceFilterSchema = z.object({
  // A payload key (e.g. "product", "amount") or a known field: "city",
  // "name"/"first_name" (maps to the event's display name).
  field: z.string().trim().min(1).max(60),
  op: z.enum(dataSourceFilterOps).default("eq"),
  value: z.string().trim().min(1).max(200),
});
export const notificationDataSourceSchema = z.object({
  eventTypes: z.array(eventTypeSchema).default([]),
  // Restrict to events from one integration source (e.g. "stripe", "shopify").
  source: z.string().trim().min(1).max(60).optional(),
  // Up to 10 simple field filters, all of which must match (AND).
  filters: z.array(dataSourceFilterSchema).max(10).optional(),
  // Deprecated free-form filter, kept so older rows stay valid.
  filter: z.record(z.string(), z.unknown()).optional(),
});
export type DataSourceFilter = z.output<typeof dataSourceFilterSchema>;

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
  imageUrl: httpUrlSchema.optional(),
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
    url: httpUrlSchema.optional(),
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

// Reviews feeding a "review" notification. Entered manually, imported from CSV,
// or (when credentials are configured) pulled from Google/Facebook. Stored
// inline on the notification so no extra event stream is needed.
export const reviewSchema = z.object({
  author: z.string().trim().min(1).max(80),
  rating: z.number().min(0).max(5).default(5),
  text: z.string().trim().min(1).max(500),
  avatarUrl: httpUrlSchema.optional(),
  // Where the review came from, shown as a small source label ("Google", etc.).
  source: z.string().trim().max(40).optional(),
});
export type Review = z.output<typeof reviewSchema>;

// Social counter (followers/likes) and YouTube stats. `count` is the number to
// show; when a platform API key is configured it can be refreshed server-side,
// otherwise the manually entered value is used.
export const socialCounterSchema = z.object({
  platform: z.string().trim().min(1).max(40),
  count: z.number().int().min(0).max(1_000_000_000),
  label: z.string().trim().max(40).optional(),
  handle: z.string().trim().max(120).optional(),
});
export type SocialCounter = z.output<typeof socialCounterSchema>;
export const youtubeStatSchema = z.object({
  metric: z.enum(["subscribers", "views"]).default("subscribers"),
  count: z.number().int().min(0).max(100_000_000_000),
  channelUrl: httpUrlSchema.optional(),
  label: z.string().trim().max(40).optional(),
});
export type YoutubeStat = z.output<typeof youtubeStatSchema>;

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
  // Inline social proof (feedback T8): when set, the pixel renders this
  // notification inside the first element matching this CSS selector on the
  // page (e.g. "#reviews"), instead of as a floating overlay.
  inlineSelector: z.string().trim().max(200).optional(),
  // Inline reviews for a "review" notification (rotated by the pixel).
  reviews: z.array(reviewSchema).max(50).optional(),
  // Social counter / YouTube stats (type-specific).
  socialCounter: socialCounterSchema.optional(),
  youtube: youtubeStatSchema.optional(),
  variants: z.array(notificationVariantSchema).min(2).max(6).optional(),
});

// Type-aware requirements that cannot be expressed by the flat config object
// alone. Returns a human message for the dashboard, or null when valid.
export function notificationTypeConfigIssue(
  type: z.output<typeof notificationTypeSchema>,
  config: z.output<typeof notificationConfigSchema>,
): string | null {
  if (type === "countdown" && !config.countdown?.endsAt) {
    return "Choose the countdown end date.";
  }
  if (type === "review" && (config.reviews?.length ?? 0) === 0) {
    return "Add at least one review.";
  }
  if (type === "social_counter" && !config.socialCounter) {
    return "Add the social counter value.";
  }
  if (type === "youtube" && !config.youtube) {
    return "Add the YouTube subscriber/view count.";
  }
  if (type === "spin_to_win" && (config.spin?.prizes.length ?? 0) < 2) {
    return "Add at least two spin prizes.";
  }
  if (type === "bar" && !["top-bar", "bottom-bar"].includes(config.style.position)) {
    return "A notification bar must use the top-bar or bottom-bar position.";
  }
  if ((type === "popup" || type === "spin_to_win") && config.style.position !== "center") {
    return "This widget must use the center position.";
  }
  return null;
}

export const createNotificationSchema = z.object({
  siteId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(120).default("Untitled notification"),
  type: notificationTypeSchema,
  config: notificationConfigSchema,
  isActive: z.boolean().default(true),
  // The owner's assertion that this proof is genuine/ethical (feedback T9 moat).
  // Controls the "✓ Verified by Tacto" badge on the widget.
  verified: z.boolean().optional(),
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
