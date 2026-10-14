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

  it("stores the email on capture only when domain privacy opts in (FR-NGS-05)", async () => {
    const created = await seedSite();
    await sites.upsertSettings(ORG, created.id, {
      loop: { loopAfter: 3, order: "random", manualOrder: [], showClose: true, closeForDays: 1 },
      privacy: {
        requireConsent: false,
        trackIpGeo: true,
        storeEmail: true,
        blockedIps: [],
        filterProfanity: false,
      },
      customCss: null,
      analyticsPassthrough: { gtag: false, dataLayer: false, fbq: false, mixpanel: false },
    });

    await widget.capture({
      site: created.siteKey,
      url: "/signup",
      fields: { name: "Jane Doe", city: "Berlin", email: "jane@example.com" },
    });
    const [captured] = await db.select().from(event).where(eq(event.siteId, created.id));
    expect((captured?.payload as { email?: string } | null)?.email).toBe("jane@example.com");
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

  it("renders conversion widgets (bar, popup, spin_to_win) with static messages", async () => {
    const created = await seedSite();
    await notifications.create(ORG, {
      siteId: created.id,
      name: "Bar",
      type: "bar",
      isActive: true,
      config: config({
        message: { template: "Free shipping today", fallbacks: {} },
        style: {
          position: "bottom-bar",
          accent: "#3B82F6",
          shape: "rounded",
          size: "md",
          animation: "slide",
        },
      }),
    });
    await notifications.create(ORG, {
      siteId: created.id,
      name: "Popup",
      type: "popup",
      isActive: true,
      config: config({
        message: { template: "Get 10% off", fallbacks: {} },
        style: {
          position: "center",
          accent: "#3B82F6",
          shape: "rounded",
          size: "md",
          animation: "slide",
        },
      }),
    });
    await notifications.create(ORG, {
      siteId: created.id,
      name: "Spin",
      type: "spin_to_win",
      isActive: true,
      config: config({
        message: { template: "WIN10", fallbacks: {} },
        style: {
          position: "center",
          accent: "#3B82F6",
          shape: "rounded",
          size: "md",
          animation: "slide",
        },
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
    expect(byType.bar?.message).toBe("Free shipping today");
    expect(byType.bar?.style.position).toBe("bottom-bar");
    expect(byType.popup?.message).toBe("Get 10% off");
    expect(byType.spin_to_win?.message).toBe("WIN10");
  });

  it("buckets A/B variants deterministically per visitor (FR-ANL-04)", async () => {
    const created = await seedSite();
    await notifications.create(ORG, {
      siteId: created.id,
      name: "AB",
      type: "recent_sales",
      isActive: true,
      config: config({
        variants: [
          { id: "A", weight: 50, message: { template: "Variant A {{product}}", fallbacks: {} } },
          { id: "B", weight: 50, message: { template: "Variant B {{product}}", fallbacks: {} } },
        ],
      }),
    });
    await db.insert(event).values({
      siteId: created.id,
      type: "purchase",
      source: "manual",
      verified: true,
      displayName: "mike",
      payload: { product: "Nike" },
      occurredAt: new Date(),
    });

    const first = await widget.getPayload({
      siteKey: created.siteKey,
      url: "/",
      origin: "https://shop.example.com",
      visitorKey: "visitor-123",
    });
    const second = await widget.getPayload({
      siteKey: created.siteKey,
      url: "/",
      origin: "https://shop.example.com",
      visitorKey: "visitor-123",
    });
    expect(first.kind).toBe("ok");
    if (first.kind !== "ok" || second.kind !== "ok") return;
    const a = first.payload.notifications[0];
    const b = second.payload.notifications[0];
    expect(a?.variantId).toBeDefined();
    expect(a?.variantId).toBe(b?.variantId); // deterministic per visitor
    expect(["A", "B"]).toContain(a?.variantId);
    expect(a?.message).toMatch(/^Variant [AB] Nike$/);
  });

  it("resolves event media via fallback priority (FR-NED-03)", async () => {
    const created = await seedSite();
    await notifications.create(ORG, {
      siteId: created.id,
      name: "Recent",
      type: "recent_sales",
      isActive: true,
      config: config(),
    });

    // Image wins when present.
    await db.insert(event).values({
      siteId: created.id,
      type: "purchase",
      source: "manual",
      verified: true,
      displayName: "mike",
      payload: { product: "Nike", image: "https://cdn.example.com/p.png", email: "a@b.com" },
      occurredAt: new Date(),
    });
    const withImage = await widget.getPayload({
      siteKey: created.siteKey,
      url: "/",
      origin: "https://shop.example.com",
    });
    expect(withImage.kind === "ok" && withImage.payload.notifications[0]?.mediaUrl).toBe(
      "https://cdn.example.com/p.png",
    );

    // Email → gravatar when there is no image.
    await db.insert(event).values({
      siteId: created.id,
      type: "purchase",
      source: "manual",
      verified: true,
      displayName: "ana",
      payload: { product: "Bag", email: "Ana@Example.com" },
      occurredAt: new Date(Date.now() + 1000),
    });
    const withEmail = await widget.getPayload({
      siteKey: created.siteKey,
      url: "/",
      origin: "https://shop.example.com",
    });
    expect(withEmail.kind === "ok" && withEmail.payload.notifications[0]?.mediaUrl).toContain(
      "gravatar.com/avatar/",
    );

    // Country → flag when there is no image/email.
    await db.insert(event).values({
      siteId: created.id,
      type: "purchase",
      source: "manual",
      verified: true,
      displayName: "leo",
      payload: { product: "Mug", country: "BR" },
      occurredAt: new Date(Date.now() + 2000),
    });
    const withCountry = await widget.getPayload({
      siteKey: created.siteKey,
      url: "/",
      origin: "https://shop.example.com",
    });
    expect(withCountry.kind === "ok" && withCountry.payload.notifications[0]?.mediaUrl).toBe(
      "https://flagcdn.com/w80/br.png",
    );
  });

  it("filters by country when geo is known, fails open when unknown (FR-NGS-07)", async () => {
    const created = await seedSite();
    await notifications.create(ORG, {
      siteId: created.id,
      name: "US only",
      type: "custom",
      isActive: true,
      config: config({
        message: { template: "Hello US", fallbacks: {} },
        display: { url: { mode: "all" }, countries: ["US"] },
      }),
    });

    const us = await widget.getPayload({
      siteKey: created.siteKey,
      url: "/",
      origin: "https://shop.example.com",
      country: "US",
    });
    const de = await widget.getPayload({
      siteKey: created.siteKey,
      url: "/",
      origin: "https://shop.example.com",
      country: "DE",
    });
    const unknown = await widget.getPayload({
      siteKey: created.siteKey,
      url: "/",
      origin: "https://shop.example.com",
      country: null,
    });

    expect(us.kind === "ok" && us.payload.notifications).toHaveLength(1);
    expect(de.kind === "ok" && de.payload.notifications).toHaveLength(0);
    expect(unknown.kind === "ok" && unknown.payload.notifications).toHaveLength(1);
  });

  it("blocks listed IPs and masks profanity (FR-NGS-07)", async () => {
    const created = await seedSite();
    await notifications.create(ORG, {
      siteId: created.id,
      name: "Custom",
      type: "custom",
      isActive: true,
      config: config({ message: { template: "This product is damn good", fallbacks: {} } }),
    });
    await sites.upsertSettings(ORG, created.id, {
      loop: { loopAfter: 3, order: "random", manualOrder: [], showClose: true, closeForDays: 1 },
      privacy: {
        requireConsent: false,
        trackIpGeo: true,
        storeEmail: false,
        blockedIps: ["203.0.113.5"],
        filterProfanity: true,
      },
      customCss: null,
      analyticsPassthrough: { gtag: false, dataLayer: false, fbq: false, mixpanel: false },
    });

    const masked = await widget.getPayload({
      siteKey: created.siteKey,
      url: "/",
      origin: "https://shop.example.com",
      requestIp: "198.51.100.9",
    });
    expect(masked.kind === "ok" && masked.payload.notifications[0]?.message).toBe(
      "This product is d**n good",
    );

    const blocked = await widget.getPayload({
      siteKey: created.siteKey,
      url: "/",
      origin: "https://shop.example.com",
      requestIp: "203.0.113.5",
    });
    expect(blocked.kind === "ok" && blocked.payload.notifications).toHaveLength(0);
  });
});
