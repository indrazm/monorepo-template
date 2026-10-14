import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { counterJobSchema } from "@repo/contracts/jobs";
import type { EventType } from "@repo/contracts/notifications";
import type { Database } from "@repo/db";
import { event, notification } from "@repo/db/schema";
import type { RealtimeStore } from "@repo/queue";

const COUNTER_WINDOW_MS = 7 * 86_400_000;
const COMBO_WINDOW_MS = 30 * 86_400_000;
// Short TTL: the widget reads this cache but refills from Postgres on a miss,
// so counters stay correct even between recomputes (SRS FR-NOT-02, FR-ANL-05).
const CACHE_TTL_SECONDS = 60;

// Recomputes counter/combo aggregates for every such notification on a site and
// writes them to the Redis cache.
export function createCounterProcessor(
  db: Pick<Database, "select">,
  store: Pick<RealtimeStore, "setCounter">,
) {
  return async function processCounterJob(job: { data: unknown }): Promise<void> {
    const { siteId } = counterJobSchema.parse(job.data);
    const rows = await db
      .select({
        id: notification.id,
        type: notification.type,
        dataSource: notification.dataSource,
      })
      .from(notification)
      .where(
        and(eq(notification.siteId, siteId), inArray(notification.type, ["counter", "combo"])),
      );
    for (const row of rows) {
      const dataSource = row.dataSource as { eventTypes?: EventType[] } | null;
      const types: EventType[] =
        dataSource?.eventTypes && dataSource.eventTypes.length > 0
          ? dataSource.eventTypes
          : ["purchase"];
      const windowMs = row.type === "combo" ? COMBO_WINDOW_MS : COUNTER_WINDOW_MS;
      const since = new Date(Date.now() - windowMs);
      const [res] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(event)
        .where(
          and(eq(event.siteId, siteId), inArray(event.type, types), gte(event.occurredAt, since)),
        );
      await store.setCounter(row.id, res?.count ?? 0, CACHE_TTL_SECONDS);
    }
  };
}
