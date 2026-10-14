import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import type { Database } from "@repo/db";
import {
  domainSetting,
  event,
  impression,
  notification,
  site,
  subscription,
} from "@repo/db/schema";
import type { CaptureEventInput, TrackEventInput } from "@repo/contracts/widget";
import { planLimits, type Plan } from "@repo/contracts/billing";
import type { RealtimeStore } from "@repo/queue";
import { analyticsPassthroughSchema, domainPrivacySchema } from "@repo/contracts/sites";
import type { DomainLoopSettings } from "@repo/contracts/sites";
import { maskProfanity } from "./profanity";
import type {
  EventType,
  NotificationConfig,
  NotificationDataSource,
  NotificationMessage,
  NotificationStyle,
  NotificationTiming,
  NotificationType,
  NotificationVariant,
} from "@repo/contracts/notifications";
import type { WidgetNotification, WidgetPayloadResponse } from "@repo/contracts/widget";
import { renderMessage } from "./template";
import { matchUrl } from "./url-match";

const DEFAULT_TTL = 30;
const LIVE_WINDOW_MS = 5 * 60_000;
const COUNTER_WINDOW_MS = 7 * 86_400_000;
const COMBO_WINDOW_MS = 30 * 86_400_000;

type NotificationRow = typeof notification.$inferSelect;
type EventRow = typeof event.$inferSelect;

export type PayloadResult =
  | { kind: "ok"; payload: WidgetPayloadResponse }
  | { kind: "not_found" }
  | { kind: "forbidden" };

// Optional async infra. With `store`, impressions are buffered in Redis (F46)
// and live-visitor/counter reads are served from Redis; without it the service
// falls back to direct Postgres writes (used by unit tests).
export type WidgetServiceDeps = {
  store?: RealtimeStore;
  enqueueCounter?: (siteId: string) => Promise<void> | void;
};

export function createWidgetService(
  db: Pick<Database, "select" | "update" | "insert">,
  deps: WidgetServiceDeps = {},
) {
  return { getPayload, recordImpression, capture };

  // Records a view/click impression (SRS FR-ANL-01). Buffered in Redis on the
  // hot path and flushed to Postgres by the worker (F46/F47); fallback inserts.
  async function recordImpression(
    input: TrackEventInput,
    meta: { visitorId?: string } = {},
  ): Promise<boolean> {
    const [siteRow] = await db
      .select({ id: site.id })
      .from(site)
      .where(eq(site.siteKey, input.site))
      .limit(1);
    if (!siteRow) return false;
    if (deps.store) {
      await deps.store.pushImpression({
        siteId: siteRow.id,
        refId: input.refId,
        kind: input.kind,
        variantId: input.variantId,
        createdAt: new Date().toISOString(),
      });
      // A view also marks the visitor present for the live-visitor window (F33).
      if (input.kind === "view" && meta.visitorId) {
        await deps.store.recordVisit(siteRow.id, meta.visitorId);
      }
    } else {
      await db.insert(impression).values({
        siteId: siteRow.id,
        refId: input.refId,
        kind: input.kind,
        variant: input.variantId ?? null,
      });
    }
    return true;
  }

  // Pixel auto-capture: turns a form submission into a form_submit event
  // (SRS FR-ING-01). Only a first name + city are stored (NFR-PRIV-01).
  async function capture(input: CaptureEventInput): Promise<boolean> {
    const [siteRow] = await db
      .select({ id: site.id })
      .from(site)
      .where(eq(site.siteKey, input.site))
      .limit(1);
    if (!siteRow) return false;
    const rawName = input.fields.name ?? input.fields.first_name ?? input.fields.fullname;
    const displayName = rawName ? rawName.trim().split(/\s+/)[0] : undefined;
    await db.insert(event).values({
      siteId: siteRow.id,
      type: "form_submit",
      source: "pixel",
      verified: false,
      displayName: displayName ?? null,
      city: input.fields.city?.trim() ?? null,
      payload: { url: input.url },
      occurredAt: new Date(),
    });
    await notifyCounter(siteRow.id);
    return true;
  }

  async function getPayload(input: {
    siteKey: string;
    url: string;
    origin: string | null;
    requestIp?: string | null;
    country?: string | null;
    locale?: string | null;
    visitorKey?: string | null;
  }): Promise<PayloadResult> {
    const [siteRow] = await db.select().from(site).where(eq(site.siteKey, input.siteKey)).limit(1);
    if (!siteRow) return { kind: "not_found" };

    // Only serve registered domains (SRS FR-SITE-03, NFR-SEC-05).
    if (!originAllowed(input.origin, siteRow.domain)) return { kind: "forbidden" };

    // First served payload from the real domain verifies the pixel (F21).
    if (!siteRow.pixelVerifiedAt) {
      await db
        .update(site)
        .set({ pixelVerifiedAt: new Date() })
        .where(and(eq(site.id, siteRow.id), isNull(site.pixelVerifiedAt)));
    }

    const [settingRow] = await db
      .select()
      .from(domainSetting)
      .where(eq(domainSetting.siteId, siteRow.id))
      .limit(1);
    const loop = (settingRow?.loop as DomainLoopSettings | undefined) ?? defaultLoop();
    const privacy = domainPrivacySchema.parse(settingRow?.privacy ?? {});
    const blocked = Boolean(input.requestIp && privacy.blockedIps.includes(input.requestIp));

    const [subRow] = await db
      .select()
      .from(subscription)
      .where(eq(subscription.organizationId, siteRow.organizationId))
      .limit(1);
    const plan = (subRow?.plan ?? "free") as Plan;

    const activeRows = await db
      .select()
      .from(notification)
      .where(and(eq(notification.siteId, siteRow.id), eq(notification.isActive, true)))
      .orderBy(desc(notification.createdAt));

    const notifications: WidgetNotification[] = [];
    // Blocked IPs get the settings/badge but no notifications (FR-NGS-07).
    if (!blocked) {
      for (const row of activeRows) {
        const config = toConfig(row);
        if (!matchUrl(config.display.url, input.url)) continue;
        // Country targeting (FR-NGS-07): a known country must be in the list.
        if (!countryAllowed(config.display.countries, input.country)) continue;
        const rendered = await renderNotification(
          siteRow.id,
          row,
          config,
          input.locale,
          input.visitorKey,
        );
        if (rendered) {
          if (privacy.filterProfanity) rendered.message = maskProfanity(rendered.message);
          notifications.push(rendered);
        }
      }
    }

    const payload: WidgetPayloadResponse = {
      notifications,
      settings: {
        loopAfter: loop.loopAfter,
        order: loop.order,
        showClose: loop.showClose,
        closeForDays: loop.closeForDays,
        showBadge: !planLimits[plan].removeBadge,
        requireConsent: privacy.requireConsent,
        customCss: (settingRow?.customCss as string | null) ?? null,
        analyticsPassthrough: analyticsPassthroughSchema.parse(
          settingRow?.analyticsPassthrough ?? {},
        ),
      },
      ttl: DEFAULT_TTL,
    };
    return { kind: "ok", payload };
  }

  // Builds the display notification for a row, or null if it has no data to show.
  async function renderNotification(
    siteId: string,
    row: NotificationRow,
    config: NotificationConfig,
    locale?: string | null,
    visitorKey?: string | null,
  ): Promise<WidgetNotification | null> {
    // A/B testing (FR-ANL-04): pick a variant deterministically per visitor.
    const variant = pickVariant(config.variants, visitorKey);
    const base = {
      id: row.id,
      type: row.type as NotificationType,
      verified: row.verified,
      style: (variant?.style ?? config.style) as NotificationStyle,
      timing: config.timing as NotificationTiming,
      ...(variant ? { variantId: variant.id } : {}),
    };
    const message = (variant?.message ?? config.message) as NotificationMessage;
    const render = (vars: Parameters<typeof renderMessage>[1] = {}) =>
      renderMessage(message, vars, locale);

    switch (row.type) {
      case "custom":
      case "popup":
      case "bar":
      case "spin_to_win":
        // Conversion widgets (F69) render a static message/CTA.
        return { ...base, message: render() };
      case "countdown": {
        // Static urgency message + a live countdown rendered by the pixel.
        const endsAt = config.countdown?.endsAt;
        if (!endsAt || new Date(endsAt).getTime() <= Date.now()) return null;
        return {
          ...base,
          message: render(),
          countdownEndsAt: endsAt,
        };
      }
      case "low_stock": {
        // FOMO: render the configured remaining stock as {{count}}.
        const stock = config.fomo?.stock ?? 0;
        return {
          ...base,
          message: render({ count: stock }),
        };
      }
      case "counter": {
        // Prefer the worker-maintained Redis cache (F32); fill it on miss.
        const count = await cachedCount(
          row.id,
          siteId,
          eventTypesOf(config.dataSource),
          COUNTER_WINDOW_MS,
        );
        if (count === 0) return null;
        return {
          ...base,
          message: render({ count }),
        };
      }
      case "combo": {
        const count = await cachedCount(
          row.id,
          siteId,
          eventTypesOf(config.dataSource),
          COMBO_WINDOW_MS,
        );
        if (count === 0) return null;
        return {
          ...base,
          message: render({ count }),
        };
      }
      case "live_visitors": {
        const count =
          deps.store !== undefined
            ? await deps.store.countVisitors(siteId)
            : await countEvents(siteId, ["visit"], LIVE_WINDOW_MS);
        return {
          ...base,
          message: render({ count }),
        };
      }
      case "review": {
        // Latest review event rendered as stars + quote + first name.
        const latest = await latestEvent(siteId, ["review"]);
        if (!latest) return null;
        const review = (latest.payload ?? {}) as { rating?: unknown; text?: unknown };
        const rating =
          typeof review.rating === "number" ? Math.max(1, Math.min(5, review.rating)) : 5;
        const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
        const text = typeof review.text === "string" ? review.text.slice(0, 160) : "";
        const author = latest.displayName ?? "A customer";
        const message = text ? `${stars} "${text}" — ${author}` : `${stars} — ${author}`;
        return { ...base, message, timeAgo: timeAgoLabel(latest.occurredAt) };
      }
      default: {
        // recent_sales / review / others: latest matching event.
        const latest = await latestEvent(siteId, eventTypesOf(config.dataSource));
        if (!latest) return null;
        const message = render({
          first_name: latest.displayName,
          city: latest.city,
          product: productOf(latest),
          occurredAt: latest.occurredAt,
        });
        return {
          ...base,
          message,
          timeAgo: timeAgoLabel(latest.occurredAt),
        };
      }
    }
  }

  async function latestEvent(siteId: string, types: EventType[]): Promise<EventRow | null> {
    const rows = await db
      .select()
      .from(event)
      .where(and(eq(event.siteId, siteId), inArray(event.type, types)))
      .orderBy(desc(event.occurredAt))
      .limit(1);
    return rows[0] ?? null;
  }

  async function countEvents(
    siteId: string,
    types: EventType[],
    windowMs: number,
  ): Promise<number> {
    const since = new Date(Date.now() - windowMs);
    const [res] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(event)
      .where(
        and(eq(event.siteId, siteId), inArray(event.type, types), gte(event.occurredAt, since)),
      );
    return res?.count ?? 0;
  }

  // Reads a counter from the worker-maintained Redis cache, filling it on a
  // miss so the widget stays correct even before the worker recomputes (F32).
  async function cachedCount(
    notificationId: string,
    siteId: string,
    types: EventType[],
    windowMs: number,
  ): Promise<number> {
    if (deps.store) {
      const cached = await deps.store.getCounter(notificationId);
      if (cached !== null) return cached;
    }
    const count = await countEvents(siteId, types, windowMs);
    if (deps.store) await deps.store.setCounter(notificationId, count, 60);
    return count;
  }

  async function notifyCounter(siteId: string): Promise<void> {
    if (!deps.enqueueCounter) return;
    try {
      await deps.enqueueCounter(siteId);
    } catch {
      // Best-effort: a failed enqueue must not affect ingestion.
    }
  }
}

function eventTypesOf(dataSource: NotificationDataSource): EventType[] {
  return dataSource.eventTypes.length > 0 ? dataSource.eventTypes : ["purchase"];
}

// Deterministic FNV-1a → [0,1). Same visitor always maps to the same variant.
function hashToUnit(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 100000) / 100000;
}

// Weighted A/B variant selection (FR-ANL-04).
function pickVariant(
  variants: NotificationVariant[] | undefined,
  visitorKey: string | null | undefined,
): NotificationVariant | null {
  if (!variants || variants.length === 0) return null;
  const total = variants.reduce((sum, variant) => sum + variant.weight, 0);
  const roll = visitorKey ? hashToUnit(visitorKey) * total : Math.random() * total;
  let acc = 0;
  for (const variant of variants) {
    acc += variant.weight;
    if (roll < acc) return variant;
  }
  return variants[variants.length - 1] ?? null;
}

function toConfig(row: NotificationRow): NotificationConfig {
  const extra = (row.extra ?? {}) as {
    countdown?: unknown;
    fomo?: unknown;
    variants?: unknown;
  };
  return {
    message: row.message,
    style: row.style,
    display: row.display,
    dataSource: row.dataSource,
    timing: row.timing,
    ...(extra.countdown ? { countdown: extra.countdown } : {}),
    ...(extra.fomo ? { fomo: extra.fomo } : {}),
    ...(extra.variants ? { variants: extra.variants } : {}),
  } as NotificationConfig;
}

function productOf(row: EventRow): string | null {
  const payload = row.payload as { product?: unknown } | null;
  return typeof payload?.product === "string" ? payload.product : null;
}

function timeAgoLabel(occurredAt: Date): string {
  const minutes = Math.floor((Date.now() - occurredAt.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

// Country targeting (FR-NGS-07). No country list → show everywhere; country
// list set but geo unknown → allow (fail-open, we cannot filter reliably).
function countryAllowed(
  countries: string[] | undefined,
  country: string | null | undefined,
): boolean {
  if (!countries || countries.length === 0) return true;
  if (!country) return true;
  const code = country.trim().toUpperCase();
  if (code === "XX" || code === "T1") return true; // Cloudflare unknown / Tor
  return countries.some((entry) => entry.toUpperCase() === code);
}

function originAllowed(origin: string | null, domain: string): boolean {
  if (!origin) return true; // server-to-server / tests
  try {
    const host = new URL(origin).hostname.toLowerCase();
    const target = domain.toLowerCase();
    return host === target || host === `www.${target}` || host.endsWith(`.${target}`);
  } catch {
    return false;
  }
}

function defaultLoop(): DomainLoopSettings {
  return { loopAfter: 3, order: "random", manualOrder: [], showClose: true, closeForDays: 1 };
}
