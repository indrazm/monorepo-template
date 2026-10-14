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
});

// ---------- telemetry (POST /widget/v1/track, beacon) ----------
export const trackEventSchema = z.object({
  site: z.string().trim().min(1),
  refId: z.string().trim().min(1),
  kind: z.enum(["view", "click"]),
  // Stable per-browser id used only to count distinct live visitors (F33).
  visitorId: z.string().trim().min(1).max(128).optional(),
});

// ---------- pixel auto-capture (POST /widget/v1/capture) ----------
export const captureEventSchema = z.object({
  site: z.string().trim().min(1),
  url: z.string().trim().min(1),
  fields: z.record(z.string(), z.string()).default({}),
});

export type WidgetNotification = z.output<typeof widgetNotificationSchema>;
export type WidgetSettings = z.output<typeof widgetSettingsSchema>;
export type WidgetPayloadResponse = z.output<typeof widgetPayloadResponseSchema>;
export type TrackEventInput = z.output<typeof trackEventSchema>;
export type CaptureEventInput = z.output<typeof captureEventSchema>;
