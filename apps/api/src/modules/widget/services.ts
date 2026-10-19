import { createHash } from "node:crypto";
import { and, desc, eq, gte, inArray, isNull, sql, type SQL } from "drizzle-orm";
import type { Database } from "@repo/db";
import { eventDataSourceConditions } from "@repo/db/filters";
import {
  domainSetting,
  event,
  impression,
  notification,
  site,
  spinClaim,
  subscription,
} from "@repo/db/schema";
import type {
  CaptureEventInput,
  SpinClaimInput,
  SpinClaimResponse,
  TrackEventInput,
  VisitEventInput,
} from "@repo/contracts/widget";
import { spinConfigSchema } from "@repo/contracts/notifications";
import {
  effectivePlanFor,
  planAllowsNotificationType,
  planLimits,
  type Plan,
} from "@repo/contracts/billing";
import { currentMonthKey, type RealtimeStore } from "@repo/queue";
import { analyticsPassthroughSchema, domainPrivacySchema } from "@repo/contracts/sites";
import type { DomainLoopSettings, DomainPrivacy } from "@repo/contracts/sites";
import { maskProfanity } from "./profanity";
import { classifyUserAgent, pathOf } from "./ua";
import type {
  EventType,
  NotificationConfig,
  NotificationDataSource,
  NotificationMedia,
  NotificationMessage,
  NotificationStyle,
  NotificationTiming,
  NotificationType,
  NotificationVariant,
} from "@repo/contracts/notifications";
import {
  widgetPayloadResponseSchema,
  type WidgetNotification,
  type WidgetPayloadResponse,
} from "@repo/contracts/widget";
import { renderMessage } from "./template";
import { matchesTargeting, targetingCacheKey, type VisitContext } from "./targeting";

const DEFAULT_TTL = 30;
// Demo events injected by the dashboard are never public social proof.
const NOT_TEST_EVENT = sql`coalesce((${event.payload} ->> 'test'), 'false') <> 'true'`;
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
  // Records event-based goal conversions for pixel-captured events (FR-ANL-03).
  onEvent?: (
    siteId: string,
    eventType: EventType,
    dedupeKey?: string | null,
  ) => Promise<void> | void;
  // Keyed static-map template (with {lat}/{lng}) for the media fallback. Unset =
  // no map fallback (audit O).
  staticMapTemplate?: string | null;
  // Where an over-quota site owner is sent to upgrade (dashboard billing page).
  upgradeUrl?: string;
  // Called when an organization crosses a quota threshold (0.8 / 1.0) so the
  // owner can be warned by email before notifications stop (FR-BIL-01).
  onQuotaThreshold?: (organizationId: string, ratio: number) => void;
  // Redis-backed limiter for the public beacon endpoints, keyed by site/IP.
  hitRateLimit?: (key: string, limit: number, windowMs: number) => Promise<boolean>;
};

// Public write beacons are limited per site/IP. They are fire-and-forget, so a
// rejected request is silently dropped by the router rather than retried.
const WRITE_RATE_LIMIT = { limit: 120, windowMs: 60_000 } as const;

type WriteMeta = { origin?: string | null; requestIp?: string | null };

export function createWidgetService(
  db: Pick<Database, "select" | "update" | "insert">,
  deps: WidgetServiceDeps = {},
) {
  return { getConfig, getPayload, recordImpression, capture, recordVisit, claimSpin };

  // Minimal, non-personal config probe used before consent. It deliberately
  // reads only the site and its privacy setting.
  async function getConfig(siteKey: string): Promise<{ requireConsent: boolean } | null> {
    const [siteRow] = await db
      .select({ id: site.id })
      .from(site)
      .where(eq(site.siteKey, siteKey))
      .limit(1);
    if (!siteRow) return null;
    const [settingRow] = await db
      .select({ privacy: domainSetting.privacy })
      .from(domainSetting)
      .where(eq(domainSetting.siteId, siteRow.id))
      .limit(1);
    const privacy = domainPrivacySchema.parse(settingRow?.privacy ?? {});
    return { requireConsent: privacy.requireConsent };
  }

  // Draws and persists a spin reward server-side. The visitor can call this
  // again (or inspect the network tab) but always receives the same prize; the
  // public payload never contains coupon codes or prize weights.
  async function claimSpin(
    input: SpinClaimInput,
    meta: WriteMeta = {},
  ): Promise<SpinClaimResponse | null> {
    const [siteRow] = await db
      .select({ id: site.id, domain: site.domain })
      .from(site)
      .where(eq(site.siteKey, input.site))
      .limit(1);
    if (!siteRow) return null;
    if (!(await allowWrite(siteRow, meta, "spin"))) return null;
    // Claims are more sensitive than impressions: cap them tightly per IP so a
    // visitor cannot farm every coupon by rotating client-side ids.
    if (
      deps.hitRateLimit &&
      !(await deps.hitRateLimit(`spin:${siteRow.id}:${meta.requestIp ?? "unknown"}`, 5, 60_000))
    ) {
      return null;
    }

    const [row] = await db
      .select({
        id: notification.id,
        type: notification.type,
        extra: notification.extra,
      })
      .from(notification)
      .where(
        and(
          eq(notification.id, input.notificationId),
          eq(notification.siteId, siteRow.id),
          eq(notification.isActive, true),
        ),
      )
      .limit(1);
    if (!row || row.type !== "spin_to_win") return null;

    const extra = (row.extra ?? {}) as { spin?: unknown };
    const parsed = spinConfigSchema.safeParse(extra.spin);
    if (!parsed.success) return null;
    const { prizes, validForDays } = parsed.data;

    const existing = await findClaim(row.id, input.visitorId);
    if (existing) return toClaimResponse(existing, validForDays);

    const total = prizes.reduce((sum, prize) => sum + prize.weight, 0);
    let roll = Math.random() * total;
    let prize = prizes[prizes.length - 1]!;
    for (const candidate of prizes) {
      roll -= candidate.weight;
      if (roll < 0) {
        prize = candidate;
        break;
      }
    }

    try {
      await db.insert(spinClaim).values({
        siteId: siteRow.id,
        notificationId: row.id,
        visitorId: input.visitorId,
        prizeLabel: prize.label,
        prizeCode: prize.code ?? null,
        prizeUrl: prize.url ?? null,
      });
    } catch (error) {
      // A concurrent request from the same visitor already inserted a claim;
      // return that prize rather than failing the spin.
      const raced = await findClaim(row.id, input.visitorId);
      if (raced) return toClaimResponse(raced, validForDays);
      throw error;
    }

    return {
      label: prize.label,
      ...(prize.code ? { code: prize.code } : {}),
      ...(prize.url ? { url: prize.url } : {}),
      validForDays,
    };
  }

  async function findClaim(notificationId: string, visitorId: string) {
    const [claim] = await db
      .select()
      .from(spinClaim)
      .where(and(eq(spinClaim.notificationId, notificationId), eq(spinClaim.visitorId, visitorId)))
      .limit(1);
    return claim ?? null;
  }

  function toClaimResponse(
    claim: typeof spinClaim.$inferSelect,
    validForDays: number,
  ): SpinClaimResponse {
    return {
      label: claim.prizeLabel,
      ...(claim.prizeCode ? { code: claim.prizeCode } : {}),
      ...(claim.prizeUrl ? { url: claim.prizeUrl } : {}),
      validForDays,
    };
  }

  // Public beacon guard: the origin must belong to the registered site and the
  // site/IP pair must stay under the write rate limit. Without an origin the
  // caller is not a browser using the pixel, so writes are rejected at the
  // router; a null origin is allowed here only for direct service tests.
  async function allowWrite(
    siteRow: { id: string; domain: string },
    meta: WriteMeta,
    action: string,
  ): Promise<boolean> {
    if (meta.origin && !originAllowed(meta.origin, siteRow.domain)) return false;
    if (!deps.hitRateLimit) return true;
    const key = `widget:${siteRow.id}:${meta.requestIp ?? "unknown"}:${action}`;
    return deps.hitRateLimit(key, WRITE_RATE_LIMIT.limit, WRITE_RATE_LIMIT.windowMs);
  }

  async function privacyFor(siteId: string): Promise<DomainPrivacy> {
    const [row] = await db
      .select({ privacy: domainSetting.privacy })
      .from(domainSetting)
      .where(eq(domainSetting.siteId, siteId))
      .limit(1);
    return domainPrivacySchema.parse(row?.privacy ?? {});
  }

  function isBlocked(privacy: { blockedIps: string[] }, requestIp?: string | null): boolean {
    return Boolean(requestIp && privacy.blockedIps.includes(requestIp));
  }

  // Records a pageview as a `visit` event once per session. This is the real
  // traffic signal behind the plan's monthly visitor quota (FR-BIL-01) and the
  // analytics live-visitor window fallback (FR-NOT-03).
  async function recordVisit(input: VisitEventInput, meta: WriteMeta = {}): Promise<boolean> {
    const [siteRow] = await db
      .select({ id: site.id, domain: site.domain, organizationId: site.organizationId })
      .from(site)
      .where(eq(site.siteKey, input.site))
      .limit(1);
    if (!siteRow) return false;
    if (!(await allowWrite(siteRow, meta, "visit"))) return false;
    const privacy = await privacyFor(siteRow.id);
    if (isBlocked(privacy, meta.requestIp)) return false;
    const [storedVisit] = await db
      .insert(event)
      .values({
        siteId: siteRow.id,
        type: "visit",
        source: "pixel",
        verified: false,
        occurredAt: new Date(),
      })
      .returning({ id: event.id });
    if (deps.onEvent) {
      try {
        await deps.onEvent(siteRow.id, "visit", storedVisit?.id);
      } catch {
        // Best-effort: goal recording must not fail the visit beacon.
      }
    }
    // Unique monthly visitors per organization drive the plan quota. Redis
    // dedupes per visitor id, so a returning visitor is counted once a month.
    if (deps.store && input.visitorId) {
      const used = await deps.store.hitVisitor(
        siteRow.organizationId,
        input.visitorId,
        currentMonthKey(),
      );
      await warnOnQuota(siteRow.organizationId, used);
    }
    return true;
  }

  // Emits the 80% / 100% warning once per organization per month.
  async function warnOnQuota(organizationId: string, used: number): Promise<void> {
    if (!deps.onQuotaThreshold || !deps.store) return;
    const quota = await quotaFor(organizationId);
    if (quota <= 0) return;
    const ratio = used / quota;
    const threshold = ratio >= 1 ? 1 : ratio >= 0.8 ? 0.8 : 0;
    if (threshold === 0) return;
    const month = currentMonthKey();
    const fresh = await deps.store.acquireLock(
      `quota-warn:${organizationId}:${month}:${threshold}`,
      40 * 86_400,
    );
    if (fresh) deps.onQuotaThreshold(organizationId, threshold);
  }

  async function quotaFor(organizationId: string): Promise<number> {
    const [subRow] = await db
      .select({ plan: subscription.plan, status: subscription.status })
      .from(subscription)
      .where(eq(subscription.organizationId, organizationId))
      .limit(1);
    const plan = effectivePlanFor((subRow?.plan ?? "free") as Plan, subRow?.status);
    return planLimits[plan].trafficQuota;
  }

  // Records a view/click impression (SRS FR-ANL-01). Buffered in Redis on the
  // hot path and flushed to Postgres by the worker (F46/F47); fallback inserts.
  async function recordImpression(
    input: TrackEventInput,
    meta: WriteMeta & {
      visitorId?: string;
      userAgent?: string | null;
      country?: string | null;
    } = {},
  ): Promise<boolean> {
    const [siteRow] = await db
      .select({ id: site.id, domain: site.domain })
      .from(site)
      .where(eq(site.siteKey, input.site))
      .limit(1);
    if (!siteRow) return false;
    if (!(await allowWrite(siteRow, meta, "track"))) return false;
    const privacy = await privacyFor(siteRow.id);
    if (isBlocked(privacy, meta.requestIp)) return false;
    // Audience dimensions for the analytics breakdown (FR-ANL-02).
    const { device, browser, isBot } = classifyUserAgent(meta.userAgent);
    const country = privacy.trackIpGeo
      ? meta.country?.trim().slice(0, 2).toUpperCase() || null
      : null;
    const path = pathOf(input.url);
    if (deps.store) {
      await deps.store.pushImpression({
        siteId: siteRow.id,
        refId: input.refId,
        kind: input.kind,
        variantId: input.variantId,
        createdAt: new Date().toISOString(),
        device,
        browser,
        ...(country ? { country } : {}),
        ...(path ? { path } : {}),
        isBot,
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
        device,
        browser,
        country,
        path,
        isBot,
      });
    }
    return true;
  }

  // Pixel auto-capture: turns a form submission into a form_submit event
  // (SRS FR-ING-01). Only a first name + city are stored (NFR-PRIV-01), unless
  // the domain's privacy settings opt in to storing the email (FR-NGS-05).
  async function capture(input: CaptureEventInput, meta: WriteMeta = {}): Promise<boolean> {
    const [siteRow] = await db
      .select({ id: site.id, domain: site.domain })
      .from(site)
      .where(eq(site.siteKey, input.site))
      .limit(1);
    if (!siteRow) return false;
    if (!(await allowWrite(siteRow, meta, "capture"))) return false;
    const [settingRow] = await db
      .select({ privacy: domainSetting.privacy })
      .from(domainSetting)
      .where(eq(domainSetting.siteId, siteRow.id))
      .limit(1);
    const privacy = domainPrivacySchema.parse(settingRow?.privacy ?? {});
    if (isBlocked(privacy, meta.requestIp)) return false;

    const rawName = input.fields.name ?? input.fields.first_name ?? input.fields.fullname;
    const displayName = rawName ? rawName.trim().split(/\s+/)[0] : undefined;
    const email = privacy.storeEmail
      ? (input.fields.email ?? input.fields.email_address)?.trim()
      : undefined;
    const [storedEvent] = await db
      .insert(event)
      .values({
        siteId: siteRow.id,
        type: "form_submit",
        source: "pixel",
        verified: false,
        displayName: displayName ?? null,
        city: input.fields.city?.trim() ?? null,
        payload: { url: input.url, ...(email ? { email } : {}) },
        occurredAt: new Date(),
      })
      .returning({ id: event.id });
    await notifyCounter(siteRow.id);
    if (deps.onEvent) {
      try {
        await deps.onEvent(siteRow.id, "form_submit", storedEvent?.id);
      } catch {
        // Best-effort: goal recording must not affect capture.
      }
    }
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
    // Visit context for targeting (FR-NED-07), reported by the pixel.
    params?: Record<string, string>;
    referrer?: string | null;
    visitor?: "new" | "returning" | null;
  }): Promise<PayloadResult> {
    const [siteRow] = await db.select().from(site).where(eq(site.siteKey, input.siteKey)).limit(1);
    if (!siteRow) return { kind: "not_found" };

    // Only serve registered domains (SRS FR-SITE-03, NFR-SEC-05).
    if (!originAllowed(input.origin, siteRow.domain)) return { kind: "forbidden" };

    // First served payload from a real browser origin verifies the pixel (F21).
    // A null Origin (curl/server-to-server) must not be able to spoof this.
    if (!siteRow.pixelVerifiedAt && input.origin) {
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
    const plan = effectivePlanFor((subRow?.plan ?? "free") as Plan, subRow?.status);

    // Monthly visitor quota (FR-BIL-01, F51). Over the quota the site serves no
    // social proof at all — the freemium tier has to convert to stay useful.
    const quota = planLimits[plan].trafficQuota;
    const used = deps.store
      ? await deps.store.getVisitorCount(siteRow.organizationId, currentMonthKey())
      : 0;
    const overQuota = quota > 0 && used > quota;

    const visitContext: VisitContext = {
      url: input.url,
      // Geo targeting is a privacy choice (NFR-PRIV-02): when the site turns
      // `trackIpGeo` off, the visitor's country is never used to filter.
      country: privacy.trackIpGeo ? input.country : null,
      params: input.params,
      referrer: input.referrer,
      visitor: input.visitor,
    };

    // Redis payload cache (NFR-PERF-02/03). Keyed by site/url/lang/country and
    // the quota state so targeting and gating stay correct. Blocked requests
    // and A/B variants bypass it.
    const cacheKey =
      deps.store && !blocked
        ? `tacto:widget:${input.siteKey}:${hashKey(input.url)}:${input.locale ?? ""}:${(
            input.country ?? ""
          ).toUpperCase()}:${hashKey(targetingCacheKey(visitContext))}:${overQuota ? "oq" : "ok"}`
        : null;
    if (deps.store && cacheKey) {
      const cached = await deps.store.cacheGet(cacheKey);
      if (cached) {
        try {
          const parsed = widgetPayloadResponseSchema.safeParse(JSON.parse(cached));
          if (parsed.success) return { kind: "ok", payload: parsed.data };
        } catch {
          /* corrupt cache entry — recompute */
        }
      }
    }

    const activeRows = await db
      .select()
      .from(notification)
      .where(and(eq(notification.siteId, siteRow.id), eq(notification.isActive, true)))
      .orderBy(desc(notification.createdAt));
    // Display order: manual drag-and-drop order, or newest-first (FR-NGS-02).
    const orderedRows = applyManualOrder(activeRows, loop);

    const notifications: WidgetNotification[] = [];
    // Blocked IPs get the settings/badge but no notifications (FR-NGS-07);
    // neither does an organization over its monthly visitor quota.
    if (!blocked && !overQuota) {
      for (const row of orderedRows) {
        // Re-check the plan at serve time: a paid notification type stops
        // rendering immediately after a downgrade or failed payment.
        if (!planAllowsNotificationType(plan, row.type as NotificationType)) continue;
        const config = toConfig(row);
        // URL, country, UTM, referrer and visitor segment (FR-NED-07).
        if (!matchesTargeting(config.display, visitContext)) continue;
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
        // Custom JS is a paid capability; never served on plans without it.
        customJs: planLimits[plan].customCode
          ? ((settingRow?.customJs as string | null) ?? null)
          : null,
        overQuota,
        upgradeUrl: overQuota ? (deps.upgradeUrl ?? null) : null,
        analyticsPassthrough: analyticsPassthroughSchema.parse(
          settingRow?.analyticsPassthrough ?? {},
        ),
      },
      ttl: DEFAULT_TTL,
    };
    // Only cache when the payload is visitor-independent (no A/B variant shown).
    if (deps.store && cacheKey && notifications.every((item) => !item.variantId)) {
      await deps.store.cacheSet(cacheKey, JSON.stringify(payload), DEFAULT_TTL);
    }
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
      ...(config.inlineSelector ? { inlineSelector: config.inlineSelector } : {}),
      // Pinned media is type-agnostic; recent-sales/review branches override it
      // with their event-derived image/avatar.
      ...(config.media?.imageUrl ? { mediaUrl: config.media.imageUrl } : {}),
      ...((variant?.style?.clickAction ?? config.style.clickAction)?.type === "url"
        ? {
            clickUrl: (variant?.style?.clickAction ?? config.style.clickAction)?.url,
            clickNewTab: (variant?.style?.clickAction ?? config.style.clickAction)?.newTab,
          }
        : {}),
    };
    const message = (variant?.message ?? config.message) as NotificationMessage;
    const render = (vars: Parameters<typeof renderMessage>[1] = {}) =>
      renderMessage(message, vars, locale);

    switch (row.type) {
      case "custom":
      case "popup":
      case "bar":
        // Conversion widgets (F69) render a static message/CTA.
        return { ...base, message: render() };
      case "review": {
        // Social proof from a customer review (feedback T6). Reviews are stored
        // inline; rotate by the minute so a cached payload stays stable briefly.
        const reviews = config.reviews ?? [];
        if (reviews.length === 0) return null;
        const review = reviews[Math.floor(Date.now() / 60_000) % reviews.length]!;
        return {
          ...base,
          message: review.text,
          author: review.author,
          rating: review.rating,
          ...(review.avatarUrl ? { mediaUrl: review.avatarUrl } : {}),
          ...(review.source ? { sourceLabel: review.source } : {}),
        };
      }
      case "social_counter": {
        // A follower/like counter (feedback T7). Value is entered manually (or
        // refreshed server-side when a platform key is configured).
        const social = config.socialCounter;
        if (!social) return null;
        const label = social.label ?? "followers";
        return {
          ...base,
          message: `${compactNumber(social.count)} ${label}`,
          sourceLabel: social.platform,
        };
      }
      case "youtube": {
        const stat = config.youtube;
        if (!stat) return null;
        const label = stat.label ?? (stat.metric === "views" ? "views" : "subscribers");
        return {
          ...base,
          message: `${compactNumber(stat.count)} ${label}`,
          sourceLabel: "YouTube",
        };
      }
      case "spin_to_win": {
        // Spin-to-win hands out a real reward (F69): the prize pool travels to
        // the pixel, which draws a winner and reveals the code/URL on claim.
        const spin = config.spin;
        if (!spin || spin.prizes.length < 2) return { ...base, message: render() };
        return {
          ...base,
          message: render(),
          spin: {
            // Labels only: the weighted draw and the coupon code stay on the
            // server and are revealed by POST /widget/v1/spin/claim.
            prizes: spin.prizes.map((prize) => ({ label: prize.label })),
            validForDays: spin.validForDays,
          },
        };
      }
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
          eventDataSourceConditions(config.dataSource),
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
          eventDataSourceConditions(config.dataSource),
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
      default: {
        // recent_sales / others: latest matching event.
        const latest = await latestEvent(
          siteId,
          eventTypesOf(config.dataSource),
          eventDataSourceConditions(config.dataSource),
        );
        if (!latest) return null;
        const message = render({
          first_name: latest.displayName,
          city: latest.city,
          product: productOf(latest),
          occurredAt: latest.occurredAt,
        });
        const mediaUrl = resolveMedia(latest.payload, deps.staticMapTemplate ?? null, config.media);
        return {
          ...base,
          message,
          timeAgo: timeAgoLabel(latest.occurredAt),
          ...(mediaUrl ? { mediaUrl } : {}),
        };
      }
    }
  }

  async function latestEvent(
    siteId: string,
    types: EventType[],
    extra: SQL[] = [],
  ): Promise<EventRow | null> {
    const rows = await db
      .select()
      .from(event)
      .where(and(eq(event.siteId, siteId), inArray(event.type, types), NOT_TEST_EVENT, ...extra))
      .orderBy(desc(event.occurredAt))
      .limit(1);
    return rows[0] ?? null;
  }

  async function countEvents(
    siteId: string,
    types: EventType[],
    windowMs: number,
    extra: SQL[] = [],
  ): Promise<number> {
    const since = new Date(Date.now() - windowMs);
    const [res] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(event)
      .where(
        and(
          eq(event.siteId, siteId),
          inArray(event.type, types),
          gte(event.occurredAt, since),
          NOT_TEST_EVENT,
          ...extra,
        ),
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
    extra: SQL[] = [],
  ): Promise<number> {
    if (deps.store) {
      const cached = await deps.store.getCounter(notificationId);
      if (cached !== null) return cached;
    }
    const count = await countEvents(siteId, types, windowMs, extra);
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

// Compact number for social/YouTube counters: 1234 → "1.2K", 1_200_000 → "1.2M".
function compactNumber(value: number): string {
  if (value < 1000) return String(value);
  const units = [
    { n: 1_000_000_000, s: "B" },
    { n: 1_000_000, s: "M" },
    { n: 1000, s: "K" },
  ];
  for (const unit of units) {
    if (value >= unit.n) {
      const scaled = value / unit.n;
      return `${scaled >= 100 ? Math.round(scaled) : scaled.toFixed(1).replace(/\.0$/, "")}${unit.s}`;
    }
  }
  return String(value);
}

// Honors the per-domain manual order (FR-NGS-02): notifications listed in
// `manualOrder` come first in that sequence; the rest keep the DB order.
function applyManualOrder<T extends { id: string }>(rows: T[], loop: DomainLoopSettings): T[] {
  if (loop.order !== "manual" || loop.manualOrder.length === 0) return rows;
  const position = new Map(loop.manualOrder.map((id, index) => [id, index]));
  return [...rows].sort((a, b) => {
    const ai = position.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bi = position.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    return ai - bi;
  });
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

// Media (FR-NED-03): an explicit image wins; otherwise the configured fallback
// preference is walked in order. `auto` keeps the historic priority
// image → map → gravatar → flag. The map step needs a keyed template; the pixel
// falls back to a type icon when this returns undefined.
function resolveMedia(
  payload: unknown,
  staticMapTemplate: string | null,
  media?: NotificationMedia,
): string | undefined {
  const data = (payload ?? {}) as Record<string, unknown>;
  if (media?.imageUrl) return media.imageUrl;
  const preference = media?.fallback ?? "auto";
  if (preference === "none") return undefined;

  const sources =
    preference === "auto"
      ? (["image", "map", "gravatar", "flag"] as const)
      : ([preference] as const);
  for (const source of sources) {
    if (source === "image") {
      const image = firstString(data.image, data.imageUrl, data.avatar, data.photo, data.picture);
      if (image) return image;
    } else if (source === "map") {
      if (!staticMapTemplate) continue;
      const lat = Number(data.lat ?? data.latitude);
      const lng = Number(data.lng ?? data.lon ?? data.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return staticMapTemplate.replace(/\{lat\}/g, String(lat)).replace(/\{lng\}/g, String(lng));
      }
    } else if (source === "gravatar") {
      const email = firstString(data.email);
      if (email) {
        const hash = createHash("md5").update(email.toLowerCase()).digest("hex");
        return `https://www.gravatar.com/avatar/${hash}?d=identicon&s=80`;
      }
    } else {
      const country = firstString(data.country, data.countryCode);
      if (country && /^[a-z]{2}$/i.test(country)) {
        return `https://flagcdn.com/w80/${country.toLowerCase()}.png`;
      }
    }
  }
  return undefined;
}

// Short stable hash of a URL, used to keep cache keys small.
function hashKey(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
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
    spin?: unknown;
    media?: unknown;
    variants?: unknown;
    reviews?: unknown;
    socialCounter?: unknown;
    youtube?: unknown;
    inlineSelector?: unknown;
  };
  return {
    message: row.message,
    style: row.style,
    display: row.display,
    dataSource: row.dataSource,
    timing: row.timing,
    ...(extra.countdown ? { countdown: extra.countdown } : {}),
    ...(extra.fomo ? { fomo: extra.fomo } : {}),
    ...(extra.spin ? { spin: extra.spin } : {}),
    ...(extra.media ? { media: extra.media } : {}),
    ...(extra.variants ? { variants: extra.variants } : {}),
    ...(extra.reviews ? { reviews: extra.reviews } : {}),
    ...(extra.socialCounter ? { socialCounter: extra.socialCounter } : {}),
    ...(extra.youtube ? { youtube: extra.youtube } : {}),
    ...(extra.inlineSelector ? { inlineSelector: extra.inlineSelector } : {}),
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
