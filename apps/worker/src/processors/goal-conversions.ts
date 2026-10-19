import { eq } from "drizzle-orm";
import type { Database } from "@repo/db";
import { goal, impression } from "@repo/db/schema";
import type { GoalRule } from "@repo/contracts/goals";
import type { EventType } from "@repo/contracts/notifications";

// Worker-side event-goal conversion. The API used to fire this before the
// event was durable (so retries double-counted); the worker now fires it only
// after a successful insert, keyed by the source event for idempotency.
export async function recordEventConversions(
  db: Pick<Database, "select" | "insert">,
  siteId: string,
  eventType: EventType,
  dedupeKey: string,
): Promise<void> {
  const rows = await db.select().from(goal).where(eq(goal.siteId, siteId));
  const goalIds = rows
    .filter((row) => {
      const rule = row.rule as GoalRule;
      return rule.type === "event" && rule.eventType === eventType;
    })
    .map((row) => row.id);
  if (goalIds.length === 0) return;
  await db
    .insert(impression)
    .values(goalIds.map((refId) => ({ siteId, refId, kind: "conversion", dedupeKey })))
    .onConflictDoNothing();
}
