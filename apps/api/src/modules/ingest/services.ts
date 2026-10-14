import { and, eq } from "drizzle-orm";
import type { Database } from "@repo/db";
import { event, integration, site } from "@repo/db/schema";
import type { IntegrationConfig } from "@repo/contracts/integrations";
import type { IngestEventInput } from "@repo/contracts/events";
import type { WebhookJob } from "@repo/contracts/jobs";
import { getConnector } from "../integrations/connectors";

const UNIQUE_VIOLATION = "23505";

export type IngestResult = "created" | "duplicate";
export type WebhookResult =
  | "created"
  | "duplicate"
  | "unauthorized"
  | "not_found"
  | "no_connector"
  | "invalid"
  | "filtered";

// Reads a dot-notation path from an unknown object (for integration filters).
function readPath(obj: unknown, path: string): string | undefined {
  let current: unknown = obj;
  for (const key of path.split(".")) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current == null ? undefined : String(current);
}

function firstName(value: string | undefined): string | null {
  if (!value) return null;
  return value.trim().split(/\s+/)[0] ?? null;
}

// Optional async infra. With `enqueueWebhook`, verified webhooks are handed to
// the worker for durable persistence (F43); without it the service writes the
// event synchronously (used by unit tests).
export type IngestServiceDeps = {
  enqueueWebhook?: (job: WebhookJob) => Promise<void>;
  enqueueCounter?: (siteId: string) => Promise<void> | void;
};

export function createIngestService(
  db: Pick<Database, "select" | "insert">,
  deps: IngestServiceDeps = {},
) {
  return { resolveSiteByApiKey, ingestEvent, processWebhook };

  // Handles an inbound provider webhook: resolve site, verify signature against
  // the configured integration secret, map via the connector, then hand a
  // normalized event to the worker queue (F43, durable/retried) — or store it
  // synchronously when no queue is configured (SRS FR-ING-03/04, FR-VER-01).
  async function processWebhook(input: {
    siteKey: string;
    provider: string;
    rawBody: string;
    headers: Record<string, string | undefined>;
  }): Promise<WebhookResult> {
    const connector = getConnector(input.provider);
    if (!connector) return "no_connector";

    const [siteRow] = await db
      .select({ id: site.id, organizationId: site.organizationId })
      .from(site)
      .where(eq(site.siteKey, input.siteKey))
      .limit(1);
    if (!siteRow) return "not_found";

    const [integrationRow] = await db
      .select({ config: integration.config })
      .from(integration)
      .where(
        and(
          eq(integration.organizationId, siteRow.organizationId),
          eq(integration.provider, input.provider),
        ),
      )
      .limit(1);
    const config = integrationRow?.config as IntegrationConfig | undefined;
    const secret = config?.secret;
    if (!secret) return "unauthorized";
    if (!connector.verify({ rawBody: input.rawBody, headers: input.headers, secret })) {
      return "unauthorized";
    }

    let raw: unknown;
    try {
      raw = JSON.parse(input.rawBody);
    } catch {
      return "invalid";
    }
    // Per-integration data filter (FR-INT-03): ack but skip non-matching events.
    if (config?.filter && readPath(raw, config.filter.path) !== config.filter.equals) {
      return "filtered";
    }
    const mapped = connector.mapToEvent(raw);
    if (!mapped) return "invalid";

    if (deps.enqueueWebhook) {
      await deps.enqueueWebhook({
        provider: input.provider,
        siteId: siteRow.id,
        receivedAt: new Date().toISOString(),
        event: {
          type: mapped.type,
          displayName: mapped.displayName,
          city: mapped.city,
          product: mapped.product,
          dedupeKey: mapped.dedupeKey,
          occurredAt: mapped.occurredAt.toISOString(),
        },
      });
      return "created";
    }

    try {
      await db.insert(event).values({
        siteId: siteRow.id,
        type: mapped.type,
        source: input.provider,
        verified: true,
        displayName: mapped.displayName,
        city: mapped.city,
        payload: mapped.product ? { product: mapped.product } : {},
        dedupeKey: mapped.dedupeKey,
        occurredAt: mapped.occurredAt,
      });
      await notifyCounter(siteRow.id);
      return "created";
    } catch (error) {
      if (isUniqueViolation(error)) return "duplicate";
      throw error;
    }
  }

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
      ...input.payload,
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
      await notifyCounter(siteId);
      return "created";
    } catch (error) {
      if (isUniqueViolation(error)) return "duplicate";
      throw error;
    }
  }

  // Best-effort: ask the worker to refresh counter/combo caches for the site.
  async function notifyCounter(siteId: string): Promise<void> {
    if (!deps.enqueueCounter) return;
    try {
      await deps.enqueueCounter(siteId);
    } catch {
      // A failed enqueue must not affect ingestion success.
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
