import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "@repo/db";
import { goal, impression, site } from "@repo/db/schema";
import type { CreateGoalInput, Goal, GoalRule } from "@repo/contracts/goals";
import { matchUrl } from "../widget/url-match";

const CONVERSION_KIND = "conversion";
type GoalRow = typeof goal.$inferSelect;

export function createGoalsService(db: Pick<Database, "select" | "insert" | "delete">) {
  return { list, create, remove, recordConversions };

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

  // Records a conversion for every URL goal of the site matching `url`. Called
  // on the public payload (pageview) with the public siteKey; best-effort.
  async function recordConversions(siteKey: string, url: string): Promise<void> {
    const [siteRow] = await db
      .select({ id: site.id })
      .from(site)
      .where(eq(site.siteKey, siteKey))
      .limit(1);
    if (!siteRow) return;
    const goals = await db.select().from(goal).where(eq(goal.siteId, siteRow.id));
    const matched = goals.filter((row) => {
      const rule = row.rule as GoalRule;
      return rule.type === "url" && matchUrl(rule.url, url);
    });
    if (matched.length === 0) return;
    await db
      .insert(impression)
      .values(matched.map((row) => ({ siteId: siteRow.id, refId: row.id, kind: CONVERSION_KIND })));
  }
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
