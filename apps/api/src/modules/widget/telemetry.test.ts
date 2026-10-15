import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { NotificationConfig } from "@repo/contracts/notifications";
import type { RealtimeStore } from "@repo/queue";
import * as schema from "@repo/db/schema";
import { createNotificationsService } from "../notifications/services";
import { createSitesService } from "../sites/services";
import { createWidgetService } from "./services";

const client = new PGlite();
const db = drizzle({ client, schema });
const notifications = createNotificationsService(db);
const sites = createSitesService(db);

const ORG = "org-a";

function createFakeStore() {
  const buffer: Parameters<RealtimeStore["pushImpression"]>[0][] = [];
  const visits: string[] = [];
  const counters = new Map<string, number>();
  const store: RealtimeStore = {
    async pushImpression(entry) {
      buffer.push(entry);
    },
    async drainImpressions() {
      return [];
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
    async acquireLock() {
      return true;
    },
    async hitVisitor() {
      return 1;
    },
    async getVisitorCount() {
      return 0;
    },
    async cacheSet() {
      /* no-op */
    },
  };
  return { store, buffer, visits, counters };
}

// Offsets the Redis hot path (F46/F33): with a store, impressions are buffered
// and live-visitor/counter reads are served from Redis rather than Postgres.
describe("widget telemetry buffering", () => {
  beforeAll(async () => {
    await migrate(db, {
      migrationsFolder: fileURLToPath(
        new URL("../../../../../packages/db/drizzle", import.meta.url),
      ),
    });
  });
  beforeEach(async () => {
    await client.exec('TRUNCATE "site" CASCADE');
  });
  afterAll(async () => {
    await client.close();
  });

  it("buffers view impressions and marks the visitor live", async () => {
    const site = await sites.create(ORG, { name: "Shop", domain: "shop.example.com" });
    const { store, buffer, visits } = createFakeStore();
    const widget = createWidgetService(db, { store });

    await widget.recordImpression(
      { site: site.siteKey, refId: "n1", kind: "view" },
      { visitorId: "v1" },
    );

    expect(buffer).toHaveLength(1);
    expect(buffer[0]).toMatchObject({ siteId: site.id, refId: "n1", kind: "view" });
    expect(visits).toEqual(["v1"]);
  });

  it("serves a cached payload on the hot path (NFR-PERF-03)", async () => {
    const site = await sites.create(ORG, { name: "Shop", domain: "shop.example.com" });
    const cached = {
      notifications: [
        {
          id: "cached",
          type: "custom",
          verified: false,
          message: "From cache",
          style: { position: "bottom-left", accent: "#000000" },
          timing: { delayMs: 0, durationMs: 5000, intervalMs: 8000 },
        },
      ],
      settings: {
        loopAfter: 3,
        order: "random",
        showClose: true,
        showBadge: true,
        analyticsPassthrough: { gtag: false, dataLayer: false, fbq: false, mixpanel: false },
      },
      ttl: 30,
    };
    const base = createFakeStore().store;
    const widget = createWidgetService(db, {
      store: { ...base, cacheGet: async () => JSON.stringify(cached) },
    });

    const result = await widget.getPayload({
      siteKey: site.siteKey,
      url: "/",
      origin: "https://shop.example.com",
    });
    expect(result.kind).toBe("ok");
    expect(result.kind === "ok" && result.payload.notifications[0]?.message).toBe("From cache");
  });

  it("does not cache an A/B variant payload (visitor-specific)", async () => {
    const site = await sites.create(ORG, { name: "Shop", domain: "shop.example.com" });
    await notifications.create(ORG, {
      siteId: site.id,
      name: "AB",
      type: "custom",
      isActive: true,
      config: config({
        variants: [
          { id: "A", weight: 50, message: { template: "A", fallbacks: {} } },
          { id: "B", weight: 50, message: { template: "B", fallbacks: {} } },
        ],
      }),
    });
    let setCalls = 0;
    const base = createFakeStore().store;
    const widget = createWidgetService(db, {
      store: { ...base, cacheSet: async () => void setCalls++ },
    });
    await widget.getPayload({
      siteKey: site.siteKey,
      url: "/",
      origin: "https://shop.example.com",
      visitorKey: "v1",
    });
    expect(setCalls).toBe(0);
  });

  it("reads live-visitor count from Redis for a live_visitors notification", async () => {
    const site = await sites.create(ORG, { name: "Shop", domain: "shop.example.com" });
    await notifications.create(ORG, {
      siteId: site.id,
      name: "Live",
      type: "live_visitors",
      isActive: true,
      config: config({ message: { template: "{{count}} people browsing", fallbacks: {} } }),
    });
    const { store } = createFakeStore();
    await store.recordVisit(site.id, "v1");
    await store.recordVisit(site.id, "v2");
    const widget = createWidgetService(db, { store });

    const result = await widget.getPayload({
      siteKey: site.siteKey,
      url: "/",
      origin: "https://shop.example.com",
    });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.payload.notifications[0]?.message).toBe("2 people browsing");
  });

  it("serves a counter from the Redis cache and caches a database miss", async () => {
    const site = await sites.create(ORG, { name: "Shop", domain: "shop.example.com" });
    const created = await notifications.create(ORG, {
      siteId: site.id,
      name: "Counter",
      type: "counter",
      isActive: true,
      config: config({ message: { template: "{{count}} sold", fallbacks: {} } }),
    });
    await db.insert(schema.event).values([
      { siteId: site.id, type: "purchase", source: "manual", occurredAt: new Date() },
      { siteId: site.id, type: "purchase", source: "manual", occurredAt: new Date() },
      { siteId: site.id, type: "purchase", source: "manual", occurredAt: new Date() },
    ]);
    if (!created) throw new Error("counter notification was not created");
    const { store, counters } = createFakeStore();
    const widget = createWidgetService(db, { store });

    // Cache miss: computed from Postgres and written back to Redis.
    const miss = await widget.getPayload({
      siteKey: site.siteKey,
      url: "/",
      origin: "https://shop.example.com",
    });
    expect(miss.kind === "ok" && miss.payload.notifications[0]?.message).toBe("3 sold");
    expect(counters.get(created.id)).toBe(3);

    // Cache hit: Redis value wins over Postgres.
    await store.setCounter(created.id, 9);
    const hit = await widget.getPayload({
      siteKey: site.siteKey,
      url: "/",
      origin: "https://shop.example.com",
    });
    expect(hit.kind === "ok" && hit.payload.notifications[0]?.message).toBe("9 sold");
  });
});

function config(overrides: Partial<NotificationConfig> = {}): NotificationConfig {
  return {
    message: { template: "{{first_name}} bought {{product}}", fallbacks: {} },
    style: {
      position: "bottom-left",
      accent: "#3B82F6",
      shape: "rounded",
      size: "md",
      animation: "slide",
    },
    display: { url: { mode: "all" } },
    dataSource: { eventTypes: ["purchase"] },
    timing: { delayMs: 0, durationMs: 5000, intervalMs: 8000 },
    ...overrides,
  };
}
