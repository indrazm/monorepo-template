import { webhookJobSchema } from "@repo/contracts/jobs";

// Normalizes a raw provider webhook into a Tacto Event (SRS FR-ING-03/FR-VER-01).
// Full provider mapping + persistence lands in EPIK F (F43); this validates the
// payload and acknowledges so the queue wiring is exercised end to end.
export async function processWebhookJob(job: { data: unknown }): Promise<void> {
  const payload = webhookJobSchema.parse(job.data);
  console.info("webhook job received", { provider: payload.provider, siteId: payload.siteId });
}
