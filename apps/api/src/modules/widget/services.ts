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
import type { DomainLoopSettings, DomainPrivacy } from "@repo/contracts/sites";
import type {
  EventType,
  NotificationConfig,
  NotificationDataSource,
  NotificationMessage,
  NotificationStyle,
  NotificationTiming,
  NotificationType,
} from "@repo/contracts/notifications";
import type { WidgetNotification, WidgetPayloadResponse } from "@repo/contracts/widget";
import { renderMessage } from "./template";
import { matchUrl } from "./url-match";

const DEFAULT_TTL = 30;
const LIVE_WINDOW_MS = 5 * 60_000;
const COUNTER_WINDOW_MS = 7 * 86_400_000;

type NotificationRow = typeof notification.$inferSelect;
type EventRow = typeof event.$inferSelect;

export type PayloadResult =
  | { kind: "ok"; payload: WidgetPayloadResponse }
  | { kind: "not_found" }
  | { kind: "forbidden" };

export function createWidgetService(db: Pick<Database, "select" | "update" | "insert">) {
  return { getPayload, recordImpression, capture };

  // Records a view/click impression (SRS FR-ANL-01). Hot-path Redis buffering
  // is a later optimization (F46/F47); for now we insert directly.
  async function recordImpression(input: TrackEventInput): Promise<boolean> {
    const [siteRow] = await db
      .select({ id: site.id })
      .from(site)
      .where(eq(site.siteKey, input.site))
      .limit(1);
    if (!siteRow) return false;
    await db
      .insert(impression)
      .values({ siteId: siteRow.id, refId: input.refId, kind: input.kind });
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
    return true;
  }

  async function getPayload(input: {
    siteKey: string;
    url: string;
    origin: string | null;
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
    const privacy = (settingRow?.privacy as DomainPrivacy | undefined) ?? defaultPrivacy();

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
    for (const row of activeRows) {
      const config = toConfig(row);
      if (!matchUrl(config.display.url, input.url)) continue;
      const rendered = await renderNotification(siteRow.id, row, config);
      if (rendered) notifications.push(rendered);
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
  ): Promise<WidgetNotification | null> {
    const base = {
      id: row.id,
      type: row.type as NotificationType,
      verified: row.verified,
      style: config.style as NotificationStyle,
      timing: config.timing as NotificationTiming,
    };

    switch (row.type) {
      case "custom":
        return { ...base, message: renderMessage(config.message as NotificationMessage, {}) };
      case "counter":
      case "combo": {
        const count = await countEvents(siteId, eventTypesOf(config.dataSource), COUNTER_WINDOW_MS);
        if (count === 0) return null;
        return {
          ...base,
          message: renderMessage(config.message as NotificationMessage, { count }),
        };
      }
      case "live_visitors": {
        const count = await countEvents(siteId, ["visit"], LIVE_WINDOW_MS);
        return {
          ...base,
          message: renderMessage(config.message as NotificationMessage, { count }),
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
        const message = renderMessage(config.message as NotificationMessage, {
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
}

function eventTypesOf(dataSource: NotificationDataSource): EventType[] {
  return dataSource.eventTypes.length > 0 ? dataSource.eventTypes : ["purchase"];
}

function toConfig(row: NotificationRow): NotificationConfig {
  return {
    message: row.message,
    style: row.style,
    display: row.display,
    dataSource: row.dataSource,
    timing: row.timing,
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
function defaultPrivacy(): DomainPrivacy {
  return { requireConsent: false, trackIpGeo: true, storeEmail: false };
}
