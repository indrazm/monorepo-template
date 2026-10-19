import { analyticsJobSchema } from "@repo/contracts/jobs";
import type { Database } from "@repo/db";
import { impression } from "@repo/db/schema";
import type { RealtimeStore } from "@repo/queue";

const FOREIGN_KEY_VIOLATION = "23503";

function isForeignKeyViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth++) {
    if (
      typeof current === "object" &&
      current !== null &&
      (current as { code?: string }).code === FOREIGN_KEY_VIOLATION
    ) {
      return true;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

// Flushes impressions buffered in Redis into Postgres (SRS FR-ANL-01/05). The
// batch is moved to a processing list first; it is acknowledged only after the
// DB commit and requeued on a transient failure.
export function createAnalyticsProcessor(
  db: Pick<Database, "insert">,
  store: Pick<RealtimeStore, "drainImpressions" | "ackImpressions" | "requeueImpressions">,
) {
  return async function processAnalyticsJob(job: { data: unknown }): Promise<void> {
    analyticsJobSchema.parse(job.data);
    const entries = await store.drainImpressions(1000);
    if (entries.length === 0) {
      await store.ackImpressions();
      return;
    }

    const rows = entries.map((entry) => ({
      siteId: entry.siteId,
      refId: entry.refId,
      kind: entry.kind,
      variant: entry.variantId ?? null,
      device: entry.device ?? null,
      browser: entry.browser ?? null,
      country: entry.country ?? null,
      path: entry.path ?? null,
      isBot: entry.isBot ?? false,
      dedupeKey: entry.id ? `buf:${entry.id}` : null,
      createdAt: new Date(entry.createdAt),
    }));

    try {
      await db.insert(impression).values(rows).onConflictDoNothing();
      await store.ackImpressions();
    } catch (error) {
      if (!isForeignKeyViolation(error)) {
        // Transient DB failure: put the batch back and let BullMQ retry.
        await store.requeueImpressions();
        throw error;
      }
      // A deleted site causes a whole-batch FK failure. Insert individually and
      // drop only the rows whose site no longer exists.
      for (const row of rows) {
        try {
          await db.insert(impression).values(row).onConflictDoNothing();
        } catch (rowError) {
          if (!isForeignKeyViolation(rowError)) {
            await store.requeueImpressions();
            throw rowError;
          }
        }
      }
      await store.ackImpressions();
    }
  };
}
