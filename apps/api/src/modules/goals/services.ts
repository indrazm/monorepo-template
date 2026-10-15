import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { Database } from "@repo/db";
import { goal, impression, notification, site } from "@repo/db/schema";
import type { CreateGoalInput, Goal, GoalRule, GoalStats } from "@repo/contracts/goals";
import type { EventType } from "@repo/contracts/notifications";
import { matchUrl } from "../widget/url-match";

const CONVERSION_KIND = "conversion";
type GoalRow = typeof goal.$inferSelect;

export function createGoalsService(db: Pick<Database, "select" | "insert" | "delete">) {
  return { list, create, remove, stats, recordConversions, recordEventConversions };

  async function ownsSite(organizationId: string, siteId: string): Promise<boolean> {
    const rows = await db
      .select({ id: site.id })
      .from(site)
      .where(and(eq(site.id, siteId), eq(site.organizationId, organizationId)))
      .limit(1);
    return rows.length > 0;
  }

  async function list(organizationId: string, siteId: string): Promise<Goal[] | null> {
    if (!(await ownsSite(organizationId, siteId))) return null;
    const rows = await db
      .select()
      .from(goal)
      .where(eq(goal.siteId, siteId))
      .orderBy(desc(goal.createdAt));
    if (rows.length === 0) return [];

    // Conversion counts for these goals in one grouped query.
    const counts = await db
      .select({ refId: impression.refId, count: sql<number>`count(*)::int` })
      .from(impression)
      .where(
        and(
          eq(impression.siteId, siteId),
          eq(impression.kind, CONVERSION_KIND),
          inArray(
            impression.refId,
            rows.map((r) => r.id),
          ),
        ),
      )
      .groupBy(impression.refId);
    const byGoal = new Map(counts.map((c) => [c.refId, c.count]));
    return rows.map((row) => toGoal(row, byGoal.get(row.id) ?? 0));
  }

  async function create(organizationId: string, input: CreateGoalInput): Promise<Goal | null> {
    if (!(await ownsSite(organizationId, input.siteId))) return null;
    const [row] = await db
      .insert(goal)
      .values({ siteId: input.siteId, name: input.name, rule: input.rule })
      .returning();
    if (!row) throw new Error("Failed to create goal.");
    return toGoal(row, 0);
  }

  async function remove(organizationId: string, id: string): Promise<boolean> {
    const rows = await db
      .select({ siteId: goal.siteId })
      .from(goal)
      .innerJoin(site, eq(goal.siteId, site.id))
      .where(and(eq(goal.id, id), eq(site.organizationId, organizationId)))
      .limit(1);
    if (rows.length === 0) return false;
    await db.delete(goal).where(eq(goal.id, id));
    return true;
  }

  // Conversion analytics for one goal (FR-ANL-03): a daily trend plus per
  // notification assisted conversions. Returns null for a foreign goal.
  async function stats(
    organizationId: string,
    goalId: string,
    days: number,
    windowMinutes: number,
  ): Promise<GoalStats | null> {
    const [goalRow] = await db
      .select({ id: goal.id, siteId: goal.siteId })
      .from(goal)
      .innerJoin(site, eq(goal.siteId, site.id))
      .where(and(eq(goal.id, goalId), eq(site.organizationId, organizationId)))
      .limit(1);
    if (!goalRow) return null;
    const since = new Date(Date.now() - days * 86_400_000);

    const conversions = await db
      .select({ createdAt: impression.createdAt })
      .from(impression)
      .where(
        and(
          eq(impression.siteId, goalRow.siteId),
          eq(impression.refId, goalId),
          eq(impression.kind, CONVERSION_KIND),
          gte(impression.createdAt, since),
        ),
      );

    // Daily trend.
    const perDay = new Map<string, number>();
    for (let i = days - 1; i >= 0; i--) {
      const day = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
      perDay.set(day, 0);
    }
    for (const conversion of conversions) {
      const day = conversion.createdAt.toISOString().slice(0, 10);
      if (perDay.has(day)) perDay.set(day, (perDay.get(day) ?? 0) + 1);
    }

    // Assisted attribution: a notification gets credit for a conversion when it
    // was viewed on the site within `windowMinutes` before it. Impressions carry
    // no visitor id, so this is a site-level (not per-visitor) signal.
    const windowMs = windowMinutes * 60_000;
    const viewSince = new Date(since.getTime() - windowMs);
    const views = await db
      .select({
        refId: impression.refId,
        createdAt: impression.createdAt,
      })
      .from(impression)
      .where(
        and(
          eq(impression.siteId, goalRow.siteId),
          eq(impression.kind, "view"),
          gte(impression.createdAt, viewSince),
        ),
      );
    const notificationIds = [...new Set(views.map((view) => view.refId))];
    const names =
      notificationIds.length > 0
        ? await db
            .select({ id: notification.id, name: notification.name })
            .from(notification)
            .where(
              and(
                eq(notification.siteId, goalRow.siteId),
                inArray(notification.id, notificationIds),
              ),
            )
        : [];
    const nameById = new Map(names.map((row) => [row.id, row.name]));

    // Sort view times per notification so each conversion can look for a
    // preceding view quickly (conversions are few relative to views).
    const viewsByNotification = new Map<string, number[]>();
    for (const view of views) {
      const list = viewsByNotification.get(view.refId) ?? [];
      list.push(view.createdAt.getTime());
      viewsByNotification.set(view.refId, list);
    }
    for (const list of viewsByNotification.values()) list.sort((a, b) => a - b);

    const assisted = new Map<string, number>();
    for (const conversion of conversions) {
      const at = conversion.createdAt.getTime();
      for (const [notificationId, times] of viewsByNotification) {
        // A view in [at - window, at] credits this notification.
        if (hasViewInWindow(times, at - windowMs, at)) {
          assisted.set(notificationId, (assisted.get(notificationId) ?? 0) + 1);
        }
      }
    }

    return {
      goalId,
      days,
      windowMinutes,
      total: conversions.length,
      daily: [...perDay.entries()].map(([date, count]) => ({ date, conversions: count })),
      attribution: [...assisted.entries()]
        .map(([notificationId, count]) => ({
          notificationId,
          name: nameById.get(notificationId) ?? "Notification",
          conversions: count,
        }))
        .sort((a, b) => b.conversions - a.conversions || a.name.localeCompare(b.name)),
    };
  }

  // Records a conversion for every URL goal of the site matching `url`. Called
  // on the public payload (pageview) with the public siteKey; best-effort.
  async function recordConversions(siteKey: string, url: string): Promise<void> {
    const goals = await goalsForSite(siteKey);
    if (!goals) return;
    const matched = goals.rows.filter((row) => {
      const rule = row.rule as GoalRule;
      return rule.type === "url" && matchUrl(rule.url, url);
    });
    await insertConversions(
      goals.siteId,
      matched.map((row) => row.id),
    );
  }

  // Records a conversion for every event goal of the site tracking `eventType`
  // (FR-ANL-03). Called right after an event is stored.
  async function recordEventConversions(siteId: string, eventType: EventType): Promise<void> {
    const rows = await db.select().from(goal).where(eq(goal.siteId, siteId));
    const matched = rows.filter((row) => {
      const rule = row.rule as GoalRule;
      return rule.type === "event" && rule.eventType === eventType;
    });
    await insertConversions(
      siteId,
      matched.map((row) => row.id),
    );
  }

  async function goalsForSite(
    siteKey: string,
  ): Promise<{ siteId: string; rows: GoalRow[] } | null> {
    const [siteRow] = await db
      .select({ id: site.id })
      .from(site)
      .where(eq(site.siteKey, siteKey))
      .limit(1);
    if (!siteRow) return null;
    const rows = await db.select().from(goal).where(eq(goal.siteId, siteRow.id));
    return { siteId: siteRow.id, rows };
  }

  async function insertConversions(siteId: string | null, goalIds: string[]): Promise<void> {
    if (!siteId || goalIds.length === 0) return;
    await db
      .insert(impression)
      .values(goalIds.map((refId) => ({ siteId, refId, kind: CONVERSION_KIND })));
  }
}

// Binary search: does `times` (sorted asc) contain a value in [low, high]?
function hasViewInWindow(times: number[], low: number, high: number): boolean {
  let lo = 0;
  let hi = times.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const value = times[mid]!;
    if (value < low) lo = mid + 1;
    else if (value > high) hi = mid - 1;
    else return true;
  }
  return false;
}

function toGoal(row: GoalRow, conversions: number): Goal {
  return {
    id: row.id,
    siteId: row.siteId,
    name: row.name,
    rule: row.rule as GoalRule,
    conversions,
    createdAt: row.createdAt.toISOString(),
  };
}
