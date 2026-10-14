import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { NotificationConfig } from "@repo/contracts/notifications";
import { event, impression, site } from "@repo/db/schema";
import * as schema from "@repo/db/schema";
import { createNotificationsService } from "../notifications/services";
import { createSitesService } from "../sites/services";
import { createWidgetService } from "./services";

const client = new PGlite();
const db = drizzle({ client, schema });
const widget = createWidgetService(db);
const notifications = createNotificationsService(db);
const sites = createSitesService(db);

const ORG = "org-a";

function config(overrides: Partial<NotificationConfig> = {}): NotificationConfig {
  return {
    message: { template: "{{first_name}} from {{city}} bought {{product}}", fallbacks: {} },
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

describe("widget payload service", () => {
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

  async function seedSite() {
    return sites.create(ORG, { name: "Shop", domain: "shop.example.com" });
  }

  it("returns not_found for an unknown site key", async () => {
    const result = await widget.getPayload({ siteKey: "nope", url: "/", origin: null });
    expect(result.kind).toBe("not_found");
  });

  it("rejects a request from an unregistered origin", async () => {
    const created = await seedSite();
    const result = await widget.getPayload({
      siteKey: created.siteKey,
      url: "/",
      origin: "https://evil.example.net",
    });
    expect(result.kind).toBe("forbidden");
  });

  it("renders a recent-sales notification from the latest event and verifies the pixel", async () => {
    const created = await seedSite();
    await notifications.create(ORG, {
      siteId: created.id,
      name: "Recent sales",
      type: "recent_sales",
      isActive: true,
      config: config(),
    });
    await db.insert(event).values({
      siteId: created.id,
      type: "purchase",
      source: "manual",
      verified: true,
      displayName: "mike",
      city: "london",
      payload: { product: "Nike Air" },
      occurredAt: new Date(),
    });

    const result = await widget.getPayload({
      siteKey: created.siteKey,
      url: "/products/shoe",
      origin: "https://shop.example.com",
    });

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.payload.notifications).toHaveLength(1);
    expect(result.payload.notifications[0]?.message).toBe("Mike from London bought Nike Air");
    expect(result.payload.settings.showBadge).toBe(true); // default free plan

    const [row] = await db.select().from(site).where(eq(site.id, created.id));
    expect(row?.pixelVerifiedAt).toBeInstanceOf(Date);
  });

  it("excludes notifications whose URL target does not match", async () => {
    const created = await seedSite();
    await notifications.create(ORG, {
      siteId: created.id,
      name: "Pricing only",
      type: "custom",
      isActive: true,
      config: config({
        message: { template: "30-day guarantee", fallbacks: {} },
        display: { url: { mode: "contains", value: "/pricing" } },
      }),
    });

    const onHome = await widget.getPayload({
      siteKey: created.siteKey,
      url: "/",
      origin: "https://shop.example.com",
    });
    const onPricing = await widget.getPayload({
      siteKey: created.siteKey,
      url: "/pricing",
      origin: "https://shop.example.com",
    });

    expect(onHome.kind === "ok" && onHome.payload.notifications).toHaveLength(0);
    expect(onPricing.kind === "ok" && onPricing.payload.notifications).toHaveLength(1);
  });

  it("records impressions and captures form submissions (first name + city only)", async () => {
    const created = await seedSite();

    await widget.recordImpression({ site: created.siteKey, refId: "n1", kind: "view" });
    await widget.recordImpression({ site: created.siteKey, refId: "n1", kind: "click" });
    const impressions = await db.select().from(impression).where(eq(impression.siteId, created.id));
    expect(impressions.map((i) => i.kind).sort()).toEqual(["click", "view"]);

    await widget.capture({
      site: created.siteKey,
      url: "/signup",
      fields: { name: "Jane Doe", city: "Berlin", email: "jane@example.com" },
    });
    const [captured] = await db.select().from(event).where(eq(event.siteId, created.id));
    expect(captured?.type).toBe("form_submit");
    expect(captured?.source).toBe("pixel");
    expect(captured?.displayName).toBe("Jane"); // first name only
    expect(captured?.city).toBe("Berlin");
  });

  it("renders a low-stock (FOMO) count and a live countdown (via the extra column)", async () => {
    const created = await seedSite();
    await notifications.create(ORG, {
      siteId: created.id,
      name: "Low stock",
      type: "low_stock",
      isActive: true,
      config: config({
        message: { template: "Only {{count}} left in stock!", fallbacks: {} },
        fomo: { stock: 3 },
      }),
    });
    const endsAt = new Date(Date.now() + 3_600_000).toISOString();
    await notifications.create(ORG, {
      siteId: created.id,
      name: "Flash sale",
      type: "countdown",
      isActive: true,
      config: config({
        message: { template: "Flash sale ends soon!", fallbacks: {} },
        countdown: { endsAt },
      }),
    });

    const result = await widget.getPayload({
      siteKey: created.siteKey,
      url: "/",
      origin: "https://shop.example.com",
    });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    const byType = Object.fromEntries(result.payload.notifications.map((n) => [n.type, n]));
    expect(byType.low_stock?.message).toBe("Only 3 left in stock!");
    expect(byType.countdown?.countdownEndsAt).toBe(endsAt);
  });
});
