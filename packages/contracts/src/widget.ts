import { z } from "zod";
import { notificationPositionSchema, notificationTypeSchema } from "./notifications";

// ---------- payload served to the pixel (GET /widget/v1/payload) ----------
export const widgetRewardSchema = z.object({
  label: z.string(),
  code: z.string().optional(),
  url: z.string().optional(),
  // Relative chance the pixel uses to draw this outcome for this visitor.
  weight: z.number().int().min(1),
});

export const widgetNotificationSchema = z.object({
  id: z.string(),
  type: notificationTypeSchema,
  verified: z.boolean(),
  message: z.string(),
  timeAgo: z.string().optional(),
  mediaUrl: z.string().optional(),
  countdownEndsAt: z.string().optional(),
  // Review notification extras (feedback T6): star rating 0–5 and the author.
  rating: z.number().min(0).max(5).optional(),
  author: z.string().optional(),
  // Small source label, e.g. "Google" for a review or "Instagram" for a counter.
  sourceLabel: z.string().optional(),
  // Inline placement target (feedback T8): a CSS selector on the host page.
  inlineSelector: z.string().optional(),
  // Which A/B variant produced this notification, if any (FR-ANL-04).
  variantId: z.string().optional(),
  // Spin-to-win prizes the pixel draws from (F69). The winner is selected in the
  // browser so the cached payload stays visitor-independent.
  spin: z
    .object({
      prizes: z.array(widgetRewardSchema).min(2),
      validForDays: z.number().int().min(1),
    })
    .optional(),
  style: z.object({
    position: notificationPositionSchema,
    accent: z.string(),
    shape: z.enum(["rounded", "square"]).default("rounded"),
    size: z.enum(["sm", "md", "lg"]).default("md"),
    animation: z.enum(["slide", "fade", "scale", "none"]).default("slide"),
    font: z.enum(["system", "rounded", "serif", "mono"]).optional(),
  }),
  // Click action (feedback T9): when present, clicking the card opens this URL.
  clickUrl: z.string().optional(),
  clickNewTab: z.boolean().optional(),
  timing: z.object({
    delayMs: z.number().int(),
    durationMs: z.number().int(),
    intervalMs: z.number().int(),
  }),
});

export const widgetSettingsSchema = z.object({
  loopAfter: z.number().int().min(0),
  order: z.enum(["random", "manual"]),
  showClose: z.boolean(),
  closeForDays: z.number().int().min(0).default(0),
  showBadge: z.boolean(),
  requireConsent: z.boolean().default(false),
  customCss: z.string().nullable().default(null),
  // Custom JS to run in the widget's sandboxed iframe (FR-NGS-04). Null unless
  // the plan allows custom code.
  customJs: z.string().nullable().default(null),
  // Monthly visitor quota exceeded (FR-BIL-01): no social proof is served and
  // the pixel shows only an upgrade hint to the site owner.
  overQuota: z.boolean().default(false),
  upgradeUrl: z.string().nullable().default(null),
  analyticsPassthrough: z.object({
    gtag: z.boolean().default(false),
    dataLayer: z.boolean().default(false),
    fbq: z.boolean().default(false),
    mixpanel: z.boolean().default(false),
  }),
});

export const widgetPayloadResponseSchema = z.object({
  notifications: z.array(widgetNotificationSchema),
  settings: widgetSettingsSchema,
  ttl: z.number().int().positive(),
});

export const widgetPayloadQuerySchema = z.object({
  site: z.string().trim().min(1),
  url: z.string().trim().min(1),
  // Visitor language (e.g. "pt-BR"), used to pick a translated template.
  lang: z.string().trim().max(35).optional(),
  // Stable per-browser id, used to bucket A/B variants deterministically.
  vid: z.string().trim().max(128).optional(),
  // Visit context for targeting (FR-NED-07): the landing URL's query string,
  // the referrer, and whether this browser has been seen before.
  q: z.string().trim().max(500).optional(),
  ref: z.string().trim().max(500).optional(),
  vs: z.enum(["new", "returning"]).optional(),
});

// ---------- telemetry (POST /widget/v1/track, beacon) ----------
export const trackEventSchema = z.object({
  site: z.string().trim().min(1),
  refId: z.string().trim().min(1),
  // "claim" is a conversion-widget outcome (e.g. a spin reward was won), kept
  // separate from a generic click so it can drive analytics and goals.
  kind: z.enum(["view", "click", "claim"]),
  // Stable per-browser id used only to count distinct live visitors (F33).
  visitorId: z.string().trim().min(1).max(128).optional(),
  // A/B variant that produced the shown notification, for per-variant analytics.
  variantId: z.string().trim().max(40).optional(),
  // Page path the impression happened on, for the analytics "top pages"
  // breakdown (FR-ANL-02). Device/browser/country are derived server-side.
  url: z.string().trim().max(2048).optional(),
});

// ---------- pixel auto-capture (POST /widget/v1/capture) ----------
export const captureEventSchema = z.object({
  site: z.string().trim().min(1),
  url: z.string().trim().min(1),
  fields: z.record(z.string(), z.string()).default({}),
});

// ---------- pageview (POST /widget/v1/visit, once per session) ----------
// Counts traffic for the plan quota and analytics (SRS FR-BIL-01).
export const visitEventSchema = z.object({
  site: z.string().trim().min(1),
  // Stable per-browser id so the monthly quota counts unique visitors, not
  // pageviews (FR-BIL-01).
  visitorId: z.string().trim().min(1).max(128).optional(),
});

export type WidgetNotification = z.output<typeof widgetNotificationSchema>;
export type WidgetSettings = z.output<typeof widgetSettingsSchema>;
export type WidgetPayloadResponse = z.output<typeof widgetPayloadResponseSchema>;
export type TrackEventInput = z.output<typeof trackEventSchema>;
export type CaptureEventInput = z.output<typeof captureEventSchema>;
export type VisitEventInput = z.output<typeof visitEventSchema>;
