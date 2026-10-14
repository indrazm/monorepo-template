import { and, eq } from "drizzle-orm";
import type { Database } from "@repo/db";
import { event, integration, site } from "@repo/db/schema";
import type { IntegrationConfig } from "@repo/contracts/integrations";
import {
  fetchGoogleReviews,
  type NormalizedReview,
} from "./import";

export type ReviewImportConfig = {
  googlePlacesApiKey: string | null;
};

export type ImportResult =
  | { ok: true; imported: number; skipped: number }
  | { ok: false; reason: "not_found" | "unconfigured" | "unsupported" };

const UNIQUE_VIOLATION = "23505";

export function createReviewsService(
  db: Pick<Database, "select" | "insert">,
  config: ReviewImportConfig,
) {
  return { importReviews };

  // Pulls reviews for a Google integration into a site as verified
  // review events, deduped by a stable key (SRS FR-ING-10, FR-VER-01).
  async function importReviews(
    organizationId: string,
    integrationId: string,
    siteId: string,
  ): Promise<ImportResult> {
    const [row] = await db
      .select({ provider: integration.provider, config: integration.config })
      .from(integration)
      .where(and(eq(integration.id, integrationId), eq(integration.organizationId, organizationId)))
      .limit(1);
    if (!row) return { ok: false, reason: "not_found" };

    const [siteRow] = await db
      .select({ id: site.id })
      .from(site)
      .where(and(eq(site.id, siteId), eq(site.organizationId, organizationId)))
      .limit(1);
    if (!siteRow) return { ok: false, reason: "not_found" };

    const cfg = (row.config ?? {}) as IntegrationConfig;
    let reviews: NormalizedReview[];
    if (row.provider === "google") {
      if (!config.googlePlacesApiKey || !cfg.placeId) return { ok: false, reason: "unconfigured" };
      reviews = await fetchGoogleReviews(config.googlePlacesApiKey, cfg.placeId);
    } else {
      return { ok: false, reason: "unsupported" };
    }

    let imported = 0;
    let skipped = 0;
    for (const review of reviews) {
      try {
        await db.insert(event).values({
          siteId: siteRow.id,
          type: "review",
          source: row.provider,
          verified: true,
          displayName: review.authorName,
          payload: { rating: review.rating, text: review.text },
          dedupeKey: review.dedupeKey,
          occurredAt: review.occurredAt,
        });
        imported++;
      } catch (error) {
        if (isUniqueViolation(error)) skipped++;
        else throw error;
      }
    }
    return { ok: true, imported, skipped };
  }
}

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth++) {
    if ((current as { code?: string }).code === UNIQUE_VIOLATION) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
