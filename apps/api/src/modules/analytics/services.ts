import { and, desc, eq, gte, ilike, isNotNull, lt, or, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { Database } from "@repo/db";
import { event, impression, notification, site } from "@repo/db/schema";
import type { Activation, AnalyticsSummary } from "@repo/contracts/analytics";
import type { EventRecord } from "@repo/contracts/events";
import {
  MIN_CLICKS_PER_ARM,
  MIN_SAMPLE_PER_ARM,
  SIGNIFICANCE_LEVEL,
  twoProportionPValue,
  wilsonInterval,
} from "./stats";

export class InvalidEventsCursorError extends Error {
  constructor() {
    super("Invalid events cursor.");
    this.name = "InvalidEventsCursorError";
  }
}

export type EventsFeedPage = { events: EventRecord[]; nextCursor: string | null };

export function createAnalyticsService(db: Pick<Database, "select">) {
  return { summary, eventsFeed, activation };

  async function siteInOrg(organizationId: string, siteId: string): Promise<boolean> {
    const rows = await db
      .select({ id: site.id })
      .from(site)
      .where(and(eq(site.id, siteId), eq(site.organizationId, organizationId)))
      .limit(1);
    return rows.length > 0;
  }

  async function summary(
    organizationId: string,
    siteId: string,
    query: { days: number; from?: string; to?: string; compare?: boolean; includeBots?: boolean },
  ): Promise<AnalyticsSummary | null> {
    if (!(await siteInOrg(organizationId, siteId))) return null;
    // Resolve the window: an explicit from/to wins, otherwise the last `days`.
    const now = new Date();
    const until = query.to ? new Date(query.to) : now;
    const since = query.from
      ? new Date(query.from)
      : new Date(until.getTime() - query.days * 86_400_000);
    const windowMs = Math.max(1, until.getTime() - since.getTime());
    const days = Math.max(1, Math.round(windowMs / 86_400_000));
    // Window conditions. The lower bound always applies; an upper bound is added
    // only for an explicit custom `to` (the live presets run open-ended to now,
    // which also avoids a timestamp-vs-Date boundary skew on just-stamped rows).
    const timeConds: SQL[] = [gte(impression.createdAt, since)];
    if (query.to) timeConds.push(lt(impression.createdAt, until));
    // Bot traffic is excluded from totals/breakdown by default (FR-ANL-02).
    const windowConds: SQL[] = [...timeConds];
    if (!query.includeBots) windowConds.push(eq(impression.isBot, false));

    const rows = await db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${impression.createdAt}), 'YYYY-MM-DD')`,
        kind: impression.kind,
        count: sql<number>`count(*)::int`,
      })
      .from(impression)
      .where(and(eq(impression.siteId, siteId), ...windowConds))
      .groupBy(sql`date_trunc('day', ${impression.createdAt})`, impression.kind);

    const byDay = new Map<string, { views: number; clicks: number; claims: number }>();
    // Fill every calendar day in the window (including zero-traffic days) so
    // the trend chart does not connect across gaps. The first bucket may be
    // partial because `since` carries a time of day.
    const firstDay = new Date(
      Date.UTC(since.getUTCFullYear(), since.getUTCMonth(), since.getUTCDate()),
    );
    for (
      let cursor = firstDay;
      cursor.getTime() <= until.getTime();
      cursor = new Date(cursor.getTime() + 86_400_000)
    ) {
      byDay.set(cursor.toISOString().slice(0, 10), { views: 0, clicks: 0, claims: 0 });
    }
    let views = 0;
    let clicks = 0;
    let claims = 0;
    for (const row of rows) {
      const bucket = byDay.get(row.day) ?? { views: 0, clicks: 0, claims: 0 };
      if (row.kind === "click") {
        bucket.clicks += row.count;
        clicks += row.count;
      } else if (row.kind === "claim") {
        bucket.claims += row.count;
        claims += row.count;
      } else if (row.kind === "view") {
        // Only real views count. Goal conversions live in the same table with
        // kind="conversion" and must never inflate impressions or CTR.
        bucket.views += row.count;
        views += row.count;
      }
      byDay.set(row.day, bucket);
    }

    const perDay = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({
        date,
        views: value.views,
        clicks: value.clicks,
        claims: value.claims,
      }));

    // Per-notification breakdown (FR-ANL-02): views/clicks/claims per notification
    // so the dashboard can show which notification actually works. Goal
    // conversions also live in this table (refId = goal id) and are excluded,
    // since they have no matching notification row.
    const notifRows = await db
      .select({
        refId: impression.refId,
        kind: impression.kind,
        count: sql<number>`count(*)::int`,
      })
      .from(impression)
      .where(and(eq(impression.siteId, siteId), ...windowConds))
      .groupBy(impression.refId, impression.kind);
    const notifMeta = await db
      .select({
        id: notification.id,
        name: notification.name,
        type: notification.type,
        isActive: notification.isActive,
      })
      .from(notification)
      .where(eq(notification.siteId, siteId));
    const metaById = new Map(notifMeta.map((row) => [row.id, row]));
    const notifMap = new Map<string, { views: number; clicks: number; claims: number }>();
    for (const row of notifRows) {
      if (!metaById.has(row.refId)) continue;
      const bucket = notifMap.get(row.refId) ?? { views: 0, clicks: 0, claims: 0 };
      if (row.kind === "click") bucket.clicks += row.count;
      else if (row.kind === "claim") bucket.claims += row.count;
      else bucket.views += row.count;
      notifMap.set(row.refId, bucket);
    }
    const notifications = [...notifMap.entries()]
      .map(([notificationId, bucket]) => {
        const meta = metaById.get(notificationId)!;
        return {
          notificationId,
          name: meta.name,
          type: meta.type,
          isActive: meta.isActive,
          views: bucket.views,
          clicks: bucket.clicks,
          claims: bucket.claims,
          ctr: bucket.views > 0 ? bucket.clicks / bucket.views : 0,
        };
      })
      .sort((a, b) => b.views - a.views || b.clicks - a.clicks);

    // Per-variant breakdown for A/B tests (FR-ANL-04), with a Wilson 95%
    // interval so a difference in CTR can be read as real or as noise.
    const variantRows = await db
      .select({
        refId: impression.refId,
        variant: impression.variant,
        kind: impression.kind,
        count: sql<number>`count(*)::int`,
      })
      .from(impression)
      .where(and(eq(impression.siteId, siteId), ...windowConds, isNotNull(impression.variant)))
      .groupBy(impression.refId, impression.variant, impression.kind);

    const variantMap = new Map<
      string,
      { notificationId: string; variantId: string; views: number; clicks: number }
    >();
    for (const row of variantRows) {
      const variantId = row.variant;
      if (!variantId) continue;
      const key = `${row.refId}\u0000${variantId}`;
      const bucket = variantMap.get(key) ?? {
        notificationId: row.refId,
        variantId,
        views: 0,
        clicks: 0,
      };
      if (row.kind === "click") bucket.clicks += row.count;
      else if (row.kind === "view") bucket.views += row.count;
      variantMap.set(key, bucket);
    }
    const variants = [...variantMap.values()].map((bucket) => {
      const { low, high } = wilsonInterval(bucket.clicks, bucket.views);
      return {
        ...bucket,
        ctr: bucket.views > 0 ? bucket.clicks / bucket.views : 0,
        ctrLow: low,
        ctrHigh: high,
      };
    });

    // A/B readout per notification (FR-ANL-04): which variant leads, and whether
    // the lead over the runner-up is statistically significant.
    const byNotification = new Map<string, typeof variants>();
    for (const variant of variants) {
      const list = byNotification.get(variant.notificationId) ?? [];
      list.push(variant);
      byNotification.set(variant.notificationId, list);
    }
    const abTests: AnalyticsSummary["abTests"] = [];
    for (const [notificationId, arms] of byNotification) {
      if (arms.length < 2) continue;
      const ranked = [...arms].sort((a, b) => b.ctr - a.ctr);
      const leader = ranked[0]!;
      const runnerUp = ranked[1]!;
      const pValue = twoProportionPValue(
        leader.clicks,
        leader.views,
        runnerUp.clicks,
        runnerUp.views,
      );
      const enoughData =
        leader.views >= MIN_SAMPLE_PER_ARM &&
        runnerUp.views >= MIN_SAMPLE_PER_ARM &&
        leader.clicks >= MIN_CLICKS_PER_ARM &&
        runnerUp.clicks >= MIN_CLICKS_PER_ARM;
      // Bonferroni correction: with up to five arms, the leader is compared
      // against the runner-up at alpha / (arms - 1), not a flat 5%.
      const adjustedLevel = SIGNIFICANCE_LEVEL / Math.max(1, arms.length - 1);
      abTests.push({
        notificationId,
        name: metaById.get(notificationId)?.name ?? "Notification",
        leaderVariantId: leader.variantId,
        runnerUpVariantId: runnerUp.variantId,
        pValue,
        significant: enoughData && pValue !== null && pValue < adjustedLevel,
        enoughData,
      });
    }

    // Comparison with the preceding window of equal length (FR-ANL-02), so the
    // dashboard can show a delta next to each total.
    let previous: AnalyticsSummary["previous"] = null;
    if (query.compare) {
      const prevSince = new Date(since.getTime() - windowMs);
      const [row] = await db
        .select({
          views: sql<number>`(count(*) filter (where ${impression.kind} = 'view'))::int`,
          clicks: sql<number>`(count(*) filter (where ${impression.kind} = 'click'))::int`,
          claims: sql<number>`(count(*) filter (where ${impression.kind} = 'claim'))::int`,
        })
        .from(impression)
        .where(
          and(
            eq(impression.siteId, siteId),
            gte(impression.createdAt, prevSince),
            lt(impression.createdAt, since),
            ...(query.includeBots ? [] : [eq(impression.isBot, false)]),
          ),
        );
      const pv = row ?? { views: 0, clicks: 0, claims: 0 };
      previous = {
        views: pv.views,
        clicks: pv.clicks,
        claims: pv.claims,
        ctr: pv.views > 0 ? pv.clicks / pv.views : 0,
      };
    }

    const audience = await audienceBreakdown(siteId, timeConds, query.includeBots ?? false);

    return {
      views,
      clicks,
      claims,
      ctr: views > 0 ? clicks / views : 0,
      days,
      perDay,
      notifications,
      variants,
      abTests,
      rangeStart: since.toISOString(),
      rangeEnd: until.toISOString(),
      previous,
      audience,
    };
  }

  // Audience breakdown over the window (FR-ANL-02): the top device/country/
  // browser/page values by impression view, plus the count of bot views so the
  // dashboard can show what the default filter hides.
  async function audienceBreakdown(
    siteId: string,
    timeConds: SQL[],
    includeBots: boolean,
  ): Promise<AnalyticsSummary["audience"]> {
    const base = [eq(impression.siteId, siteId), eq(impression.kind, "view"), ...timeConds];
    const botFilter = includeBots ? [] : [eq(impression.isBot, false)];

    async function topBy(column: AnyPgColumn): Promise<{ key: string; count: number }[]> {
      const rows = await db
        .select({ key: column, count: sql<number>`count(*)::int` })
        .from(impression)
        .where(and(...base, ...botFilter, isNotNull(column)))
        .groupBy(column)
        .orderBy(desc(sql`count(*)`))
        .limit(8);
      return rows
        .filter((row) => row.key != null && String(row.key) !== "")
        .map((row) => ({ key: String(row.key), count: row.count }));
    }

    const [devices, browsers, countries, pages, botRow] = await Promise.all([
      topBy(impression.device),
      topBy(impression.browser),
      topBy(impression.country),
      topBy(impression.path),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(impression)
        .where(and(...base, eq(impression.isBot, true))),
    ]);
    return { devices, countries, browsers, pages, botViews: botRow[0]?.count ?? 0 };
  }

  // Keyset-paginated events feed (newest first), cursor = last event id, with
  // optional type/source/verified/name filters (FR-ING-11).
  async function eventsFeed(
    organizationId: string,
    siteId: string,
    filters: {
      limit: number;
      cursor?: string;
      type?: EventRecord["type"];
      source?: EventRecord["source"];
      verified?: boolean;
      q?: string;
    },
  ): Promise<EventsFeedPage | null> {
    if (!(await siteInOrg(organizationId, siteId))) return null;
    const { limit, cursor, type, source, verified, q } = filters;

    // Dashboard test events are a preview, not part of the customer's feed.
    let where = and(
      eq(event.siteId, siteId),
      sql`coalesce((${event.payload} ->> 'test'), 'false') <> 'true'`,
    )!;
    if (type) where = and(where, eq(event.type, type))!;
    if (source) where = and(where, eq(event.source, source))!;
    if (verified !== undefined) where = and(where, eq(event.verified, verified))!;
    if (q) {
      const like = `%${q}%`;
      where = and(where, or(ilike(event.displayName, like), ilike(event.city, like)))!;
    }
    if (cursor) {
      const [cursorRow] = await db
        .select({ occurredAt: event.occurredAt, id: event.id })
        .from(event)
        .where(and(eq(event.siteId, siteId), eq(event.id, cursor)))
        .limit(1);
      if (!cursorRow) throw new InvalidEventsCursorError();
      where = and(
        where,
        or(
          lt(event.occurredAt, cursorRow.occurredAt),
          and(eq(event.occurredAt, cursorRow.occurredAt), lt(event.id, cursorRow.id)),
        ),
      )!;
    }

    const rows = await db
      .select()
      .from(event)
      .where(where)
      .orderBy(desc(event.occurredAt), desc(event.id))
      .limit(limit + 1);
    const visible = rows.slice(0, limit);
    return {
      nextCursor: rows.length > limit ? (visible.at(-1)?.id ?? null) : null,
      events: visible.map((row) => ({
        id: row.id,
        siteId: row.siteId,
        type: row.type,
        source: row.source as EventRecord["source"],
        verified: row.verified,
        displayName: row.displayName,
        city: row.city,
        occurredAt: row.occurredAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  // Activation funnel for onboarding (F70). Returns null for a foreign site.
  async function activation(organizationId: string, siteId: string): Promise<Activation | null> {
    const [siteRow] = await db
      .select({ createdAt: site.createdAt, pixelVerifiedAt: site.pixelVerifiedAt })
      .from(site)
      .where(and(eq(site.id, siteId), eq(site.organizationId, organizationId)))
      .limit(1);
    if (!siteRow) return null;

    const [notifications] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notification)
      .where(eq(notification.siteId, siteId));
    const [events] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(event)
      .where(eq(event.siteId, siteId));
    const [impressions] = await db
      .select({
        count: sql<number>`count(*)::int`,
        first: sql<Date | string | null>`min(${impression.createdAt})`,
      })
      .from(impression)
      .where(eq(impression.siteId, siteId));

    const impressionCount = impressions?.count ?? 0;
    const firstRaw = impressions?.first ?? null;
    const firstImpressionAt = firstRaw ? new Date(firstRaw) : null;
    const pixelVerifiedAt = siteRow.pixelVerifiedAt;
    return {
      siteId,
      hasPixel: Boolean(pixelVerifiedAt),
      pixelVerifiedAt: pixelVerifiedAt ? pixelVerifiedAt.toISOString() : null,
      notificationCount: notifications?.count ?? 0,
      eventCount: events?.count ?? 0,
      impressionCount,
      firstImpressionAt: firstImpressionAt ? firstImpressionAt.toISOString() : null,
      activated: impressionCount > 0,
      msToActivation:
        firstImpressionAt && siteRow.createdAt
          ? Math.max(0, firstImpressionAt.getTime() - siteRow.createdAt.getTime())
          : null,
    };
  }
}
