import { analyticsJobSchema } from "@repo/contracts/jobs";

// Flushes buffered impressions from Redis into Postgres rollups (SRS FR-ANL-05).
// Full flush logic lands in EPIK H (F47); this validates the payload.
export async function processAnalyticsJob(job: { data: unknown }): Promise<void> {
  const payload = analyticsJobSchema.parse(job.data);
  console.info("analytics-aggregate job received", { siteId: payload.siteId ?? "all" });
}
