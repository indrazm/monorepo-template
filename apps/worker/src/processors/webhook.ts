import { webhookJobSchema } from "@repo/contracts/jobs";
import type { Database } from "@repo/db";
import { event } from "@repo/db/schema";
import type { EventType } from "@repo/contracts/notifications";

const UNIQUE_VIOLATION = "23505";

// Persists a verified webhook event handed over by the API (SRS FR-ING-03,
// FR-VER-01). The API already verified the signature and mapped the provider
// payload; the worker owns the durable, retried write. Duplicates (dedupeKey)
// are ignored so the job is idempotent.
export function createWebhookProcessor(
  db: Pick<Database, "insert">,
  enqueueCounter?: (siteId: string) => Promise<void> | void,
  onEvent?: (siteId: string, eventType: EventType, dedupeKey: string) => Promise<void> | void,
) {
  return async function processWebhookJob(job: { data: unknown }): Promise<void> {
    const payload = webhookJobSchema.parse(job.data);
    const mapped = payload.event;
    let eventId: string | undefined;
    try {
      const [stored] = await db
        .insert(event)
        .values({
          siteId: payload.siteId,
          type: mapped.type,
          source: payload.provider,
          verified: true,
          displayName: mapped.displayName,
          city: mapped.city,
          payload: mapped.product ? { product: mapped.product } : null,
          dedupeKey: mapped.dedupeKey,
          occurredAt: new Date(mapped.occurredAt),
        })
        .returning({ id: event.id });
      eventId = stored?.id;
    } catch (error) {
      if (isUniqueViolation(error)) return;
      throw error;
    }
    // Fire conversions only after the event is durable, and key them by the
    // event so a retried delivery cannot increment the goal twice.
    if (onEvent && eventId) {
      try {
        await onEvent(payload.siteId, mapped.type, mapped.dedupeKey ?? eventId);
      } catch {
        // Best-effort: goal recording must not fail the persisted event.
      }
    }
    if (enqueueCounter) {
      try {
        await enqueueCounter(payload.siteId);
      } catch {
        // Best-effort: counter refresh must not fail the persisted event.
      }
    }
  };
}

// Drizzle wraps the driver error, so the Postgres SQLSTATE can be on the error
// itself or on its `cause` chain.
function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth++) {
    if (
      typeof current === "object" &&
      current !== null &&
      (current as { code?: string }).code === UNIQUE_VIOLATION
    ) {
      return true;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
