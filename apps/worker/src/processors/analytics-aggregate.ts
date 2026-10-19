import { analyticsJobSchema } from "@repo/contracts/jobs";
import type { Database } from "@repo/db";
import { impression } from "@repo/db/schema";
import type { RealtimeStore } from "@repo/queue";

// Flushes impressions buffered in Redis into Postgres (SRS FR-ANL-01/05). Runs
// as a repeatable job scheduled in worker.ts, so the API hot path only does an
// RPUSH. A stale entry (site deleted) is dropped rather than failing the batch.
export function createAnalyticsProcessor(
  db: Pick<Database, "insert">,
  store: Pick<RealtimeStore, "drainImpressions">,
) {
  return async function processAnalyticsJob(job: { data: unknown }): Promise<void> {
    analyticsJobSchema.parse(job.data);
    const entries = await store.drainImpressions(1000);
    for (const entry of entries) {
      try {
        await db.insert(impression).values({
          siteId: entry.siteId,
          refId: entry.refId,
          kind: entry.kind,
          variant: entry.variantId ?? null,
          device: entry.device ?? null,
          browser: entry.browser ?? null,
          country: entry.country ?? null,
          path: entry.path ?? null,
          isBot: entry.isBot ?? false,
          createdAt: new Date(entry.createdAt),
        });
      } catch {
        // Foreign-key violation for a removed site — drop the buffered row.
      }
    }
  };
}
