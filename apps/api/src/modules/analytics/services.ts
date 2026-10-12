import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { Database } from "@repo/db";
import { event, impression, site } from "@repo/db/schema";
import type { AnalyticsSummary } from "@repo/contracts/analytics";
import type { EventRecord } from "@repo/contracts/events";

export function createAnalyticsService(db: Pick<Database, "select">) {
  return { summary, eventsFeed };

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
    days: number,
  ): Promise<AnalyticsSummary | null> {
    if (!(await siteInOrg(organizationId, siteId))) return null;
    const since = new Date(Date.now() - days * 86_400_000);

    const rows = await db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${impression.createdAt}), 'YYYY-MM-DD')`,
        kind: impression.kind,
        count: sql<number>`count(*)::int`,
      })
      .from(impression)
      .where(and(eq(impression.siteId, siteId), gte(impression.createdAt, since)))
      .groupBy(sql`date_trunc('day', ${impression.createdAt})`, impression.kind);

    const byDay = new Map<string, { views: number; clicks: number }>();
    let views = 0;
    let clicks = 0;
    for (const row of rows) {
      const bucket = byDay.get(row.day) ?? { views: 0, clicks: 0 };
      if (row.kind === "click") {
        bucket.clicks += row.count;
        clicks += row.count;
      } else {
        bucket.views += row.count;
        views += row.count;
      }
      byDay.set(row.day, bucket);
    }

    const perDay = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ date, views: value.views, clicks: value.clicks }));

    return { views, clicks, ctr: views > 0 ? clicks / views : 0, days, perDay };
  }

  async function eventsFeed(
    organizationId: string,
    siteId: string,
    limit: number,
  ): Promise<EventRecord[] | null> {
    if (!(await siteInOrg(organizationId, siteId))) return null;
    const rows = await db
      .select()
      .from(event)
      .where(eq(event.siteId, siteId))
      .orderBy(desc(event.occurredAt))
      .limit(limit);
    return rows.map((row) => ({
      id: row.id,
      siteId: row.siteId,
      type: row.type,
      source: row.source as EventRecord["source"],
      verified: row.verified,
      displayName: row.displayName,
      city: row.city,
      occurredAt: row.occurredAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
