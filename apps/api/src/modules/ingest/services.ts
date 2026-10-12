import { eq } from "drizzle-orm";
import type { Database } from "@repo/db";
import { event, site } from "@repo/db/schema";
import type { IngestEventInput } from "@repo/contracts/events";

const UNIQUE_VIOLATION = "23505";

export type IngestResult = "created" | "duplicate";

function firstName(value: string | undefined): string | null {
  if (!value) return null;
  return value.trim().split(/\s+/)[0] ?? null;
}

export function createIngestService(db: Pick<Database, "select" | "insert">) {
  return { resolveSiteByApiKey, ingestEvent };

  async function resolveSiteByApiKey(apiKey: string): Promise<string | null> {
    const rows = await db
      .select({ id: site.id })
      .from(site)
      .where(eq(site.apiKey, apiKey))
      .limit(1);
    return rows[0]?.id ?? null;
  }

  // Stores an event, anonymized to first name + city (SRS FR-ING-06), rejecting
  // duplicates by dedupeKey (FR-ING-07). Manual/API events are not "verified".
  async function ingestEvent(siteId: string, input: IngestEventInput): Promise<IngestResult> {
    const payload = {
      ...(input.payload ?? {}),
      ...(input.product ? { product: input.product } : {}),
    };
    try {
      await db.insert(event).values({
        siteId,
        type: input.type,
        source: "manual",
        verified: false,
        displayName: firstName(input.displayName),
        city: input.city?.trim() ?? null,
        payload,
        dedupeKey: input.dedupeKey ?? null,
        occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
      });
      return "created";
    } catch (error) {
      if (isUniqueViolation(error)) return "duplicate";
      throw error;
    }
  }
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
