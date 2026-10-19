import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@repo/db/schema";
import { createApp } from "./app";
import { createNotificationsService } from "./modules/notifications/services";
import { createSitesService } from "./modules/sites/services";

// End-to-end through the real Hono app (routing + handlers + public CORS) over
// a pglite-backed database — the pixel's payload path a customer site hits.
const client = new PGlite();
const db = drizzle({ client, schema });
const app = createApp({
  db,
  config: {
    clientOrigins: ["http://localhost:3000"],
    stripe: {
      secretKey: null,
      webhookSecret: null,
      prices: {
        starter: { month: null, year: null },
        growth: { month: null, year: null },
        agency: { month: null, year: null },
      },
      trialDays: 0,
    },
    publicApiUrl: "http://localhost:8000",
    credentialsSecret: "test-credentials-secret",
    media: { staticMapTemplate: null },
    integrations: { shopify: null, hubspot: null },
    reviews: { googlePlacesApiKey: null, facebookPageToken: null },
    social: { youtubeApiKey: null },
  },
  auth: {
    getSession: async () => null,
    handler: async () => new Response(null, { status: 404 }),
  },
});

describe("widget payload (HTTP end-to-end)", () => {
  beforeAll(async () => {
    await migrate(db, {
      migrationsFolder: fileURLToPath(new URL("../../../packages/db/drizzle", import.meta.url)),
    });
  });
  afterAll(async () => {
    await client.close();
  });

  it("serves an active notification for a registered site over HTTP", async () => {
    const sites = createSitesService(db);
    const notifications = createNotificationsService(db);
    const site = await sites.create("org-a", { name: "Shop", domain: "shop.example.com" });
    await notifications.create("org-a", {
      siteId: site.id,
      name: "Guarantee",
      type: "custom",
      isActive: true,
      config: {
        message: { template: "30-day money-back guarantee", fallbacks: {} },
        style: {
          position: "bottom-left",
          accent: "#3B82F6",
          shape: "rounded",
          size: "md",
          animation: "slide",
        },
        display: { url: { mode: "all" } },
        dataSource: { eventTypes: [] },
        timing: { delayMs: 0, durationMs: 5000, intervalMs: 8000 },
      },
    });

    const response = await app.request(
      `/widget/v1/payload?site=${site.siteKey}&url=${encodeURIComponent("/")}`,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    const body = (await response.json()) as {
      notifications: { message: string }[];
      settings: { showBadge: boolean };
    };
    expect(body.notifications[0]?.message).toBe("30-day money-back guarantee");
    expect(body.settings.showBadge).toBe(true);
  });

  it("returns 404 for an unknown site key", async () => {
    const response = await app.request("/widget/v1/payload?site=missing&url=/");
    expect(response.status).toBe(404);
  });

  it("exposes only the consent requirement before consent", async () => {
    const sites = createSitesService(db);
    const site = await sites.create("org-a", { name: "Config Shop", domain: "config.example.com" });
    const response = await app.request(`/widget/v1/config?site=${site.siteKey}`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ requireConsent: false });
  });

  it("rejects write beacons that do not come from a browser origin", async () => {
    const sites = createSitesService(db);
    const site = await sites.create("org-a", { name: "Write Shop", domain: "write.example.com" });
    const response = await app.request("/widget/v1/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ site: site.siteKey, visitorId: "v1" }),
    });
    expect(response.status).toBe(403);
  });
});
