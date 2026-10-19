import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { event, goal, impression, notification } from "@repo/db/schema";
import * as schema from "@repo/db/schema";
import type { RealtimeStore } from "@repo/queue";
import { createAnalyticsProcessor } from "./analytics-aggregate";
import { createCounterProcessor } from "./counter-recompute";
import { recordEventConversions } from "./goal-conversions";
import { createWebhookProcessor } from "./webhook";

const client = new PGlite();
const db = drizzle({ client, schema });

// In-memory stand-in for the Redis-backed store: exercises the processors'
// aggregation/persistence logic without a live Redis.
function createFakeStore() {
  const buffer: Parameters<RealtimeStore["pushImpression"]>[0][] = [];
  const counters = new Map<string, number>();
  const visits: string[] = [];
  const store: RealtimeStore = {
    async pushImpression(entry) {
      buffer.push(entry);
    },
    async drainImpressions(limit = 1000) {
      return buffer.splice(0, limit);
    },
    async recordVisit(_siteId, visitorId) {
      visits.push(visitorId);
    },
    async countVisitors() {
      return new Set(visits).size;
    },
    async setCounter(id, count) {
      counters.set(id, count);
    },
    async getCounter(id) {
      return counters.get(id) ?? null;
    },
    async hitRateLimit() {
      return true;
    },
    async cacheGet() {
      return null;
    },
    async cacheSet() {
      /* no-op */
    },
    async acquireLock() {
      return true;
    },
    async hitVisitor() {
      return 1;
    },
    async getVisitorCount() {
      return 0;
    },
  };
  return { store, buffer, counters };
}

async function seedSite() {
  const [row] = await db
    .insert(schema.site)
    .values({ organizationId: "org-a", name: "Shop", domain: "shop.example.com" })
    .returning();
  return row!;
}

describe("worker processors", () => {
  beforeAll(async () => {
    await migrate(db, {
      migrationsFolder: fileURLToPath(new URL("../../../../packages/db/drizzle", import.meta.url)),
    });
  });
  beforeEach(async () => {
    await client.exec('TRUNCATE "site" CASCADE');
  });
  afterAll(async () => {
    await client.close();
  });

  it("persists a verified webhook event and ignores duplicates", async () => {
    const site = await seedSite();
    const enqueued: string[] = [];
    const process = createWebhookProcessor(db, (siteId) => {
      enqueued.push(siteId);
    });
    const job = {
      data: {
        provider: "stripe",
        siteId: site.id,
        receivedAt: new Date().toISOString(),
        event: {
          type: "purchase",
          displayName: "Jane",
          city: "Berlin",
          product: "Pro plan",
          dedupeKey: "cs_1",
          occurredAt: new Date().toISOString(),
        },
      },
    };

    await process(job);
    await process(job); // duplicate dedupeKey — idempotent

    const rows = await db.select().from(event);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.verified).toBe(true);
    expect(rows[0]?.source).toBe("stripe");
    expect(rows[0]?.displayName).toBe("Jane");
    expect(enqueued).toEqual([site.id]); // counter refresh enqueued once
  });

  it("records one goal conversion for a retried event", async () => {
    const site = await seedSite();
    const [storedGoal] = await db
      .insert(goal)
      .values({
        siteId: site.id,
        name: "Purchase",
        rule: { type: "event", eventType: "purchase" },
      })
      .returning();
    const process = createWebhookProcessor(db, undefined, (siteId, eventType, dedupeKey) =>
      recordEventConversions(db, siteId, eventType, dedupeKey),
    );
    const job = {
      data: {
        provider: "stripe",
        siteId: site.id,
        receivedAt: new Date().toISOString(),
        event: {
          type: "purchase",
          displayName: null,
          city: null,
          product: "Pro plan",
          dedupeKey: "order-retry-1",
          occurredAt: new Date().toISOString(),
        },
      },
    };

    await process(job);
    await process(job);

    const conversions = await db
      .select()
      .from(impression)
      .where(eq(impression.refId, storedGoal!.id));
    expect(conversions).toHaveLength(1);
    expect(conversions[0]?.kind).toBe("conversion");
  });

  it("flushes buffered impressions into Postgres", async () => {
    const site = await seedSite();
    const { store, buffer } = createFakeStore();
    await store.pushImpression({
      siteId: site.id,
      refId: "n1",
      kind: "view",
      createdAt: new Date().toISOString(),
    });
    await store.pushImpression({
      siteId: site.id,
      refId: "n1",
      kind: "click",
      createdAt: new Date().toISOString(),
    });

    await createAnalyticsProcessor(db, store)({ data: {} });

    const rows = await db.select().from(impression);
    expect(rows.map((r) => r.kind).sort()).toEqual(["click", "view"]);
    expect(buffer).toHaveLength(0);
  });

  it("drops buffered impressions for a deleted site without failing", async () => {
    const { store } = createFakeStore();
    await store.pushImpression({
      siteId: "gone",
      refId: "n1",
      kind: "view",
      createdAt: new Date().toISOString(),
    });
    await expect(createAnalyticsProcessor(db, store)({ data: {} })).resolves.toBeUndefined();
    expect(await db.select().from(impression)).toHaveLength(0);
  });

  it("recomputes counter/combo caches for a site", async () => {
    const site = await seedSite();
    await db.insert(notification).values({
      siteId: site.id,
      name: "Recent sales counter",
      type: "counter",
      message: { template: "{{count}} sales", fallbacks: {} },
      style: { position: "bottom-left", accent: "#3B82F6" },
      display: { url: { mode: "all" } },
      dataSource: { eventTypes: ["purchase"] },
      timing: { delayMs: 0, durationMs: 5000, intervalMs: 8000 },
    });
    await db.insert(event).values([
      { siteId: site.id, type: "purchase", source: "manual", occurredAt: new Date() },
      { siteId: site.id, type: "purchase", source: "manual", occurredAt: new Date() },
      { siteId: site.id, type: "signup", source: "manual", occurredAt: new Date() },
    ]);

    const { store, counters } = createFakeStore();
    await createCounterProcessor(db, store)({ data: { siteId: site.id } });

    const [row] = await db.select().from(notification);
    expect(row).toBeDefined();
    expect(counters.get(row!.id)).toBe(2); // only purchases counted
  });
});
