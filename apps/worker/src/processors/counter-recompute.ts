import { counterJobSchema } from "@repo/contracts/jobs";

// Recomputes counter aggregates for a notification over its period (SRS FR-NOT-02).
// Full aggregation + Redis cache lands in EPIK E (F32); this validates the payload.
export async function processCounterJob(job: { data: unknown }): Promise<void> {
  const payload = counterJobSchema.parse(job.data);
  console.info("counter-recompute job received", {
    notificationId: payload.notificationId,
    periodDays: payload.periodDays,
  });
}
