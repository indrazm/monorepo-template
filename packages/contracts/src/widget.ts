import { z } from "zod";
import { notificationPositionSchema, notificationTypeSchema } from "./notifications";

// ---------- payload served to the pixel (GET /widget/v1/payload) ----------
export const widgetNotificationSchema = z.object({
  id: z.string(),
  type: notificationTypeSchema,
  verified: z.boolean(),
  message: z.string(),
  timeAgo: z.string().optional(),
  mediaUrl: z.string().optional(),
  countdownEndsAt: z.string().optional(),
  // Which A/B variant produced this notification, if any (FR-ANL-04).
  variantId: z.string().optional(),
  style: z.object({
    position: notificationPositionSchema,
    accent: z.string(),
    shape: z.enum(["rounded", "square"]).default("rounded"),
    size: z.enum(["sm", "md"]).default("md"),
    animation: z.enum(["slide", "fade"]).default("slide"),
  }),
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
  kind: z.enum(["view", "click"]),
  // Stable per-browser id used only to count distinct live visitors (F33).
  visitorId: z.string().trim().min(1).max(128).optional(),
  // A/B variant that produced the shown notification, for per-variant analytics.
  variantId: z.string().trim().max(40).optional(),
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
