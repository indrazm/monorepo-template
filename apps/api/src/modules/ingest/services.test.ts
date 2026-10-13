import { createHmac } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { event, site } from "@repo/db/schema";
import * as schema from "@repo/db/schema";
import { createIngestService } from "./services";
import { createSitesService } from "../sites/services";

const client = new PGlite();
const db = drizzle({ client, schema });
const ingest = createIngestService(db);
const sites = createSitesService(db);

describe("ingest service", () => {
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

  async function seedSiteWithKey() {
    const created = await sites.create("org-a", { name: "Shop", domain: "shop.example.com" });
    const [row] = await db.select().from(site).where(eq(site.id, created.id));
    return { id: created.id, apiKey: row!.apiKey };
  }

  it("resolves a site by its secret api key", async () => {
    const { id, apiKey } = await seedSiteWithKey();
    expect(await ingest.resolveSiteByApiKey(apiKey)).toBe(id);
    expect(await ingest.resolveSiteByApiKey("wrong")).toBeNull();
  });

  it("stores an event anonymized to first name + city", async () => {
    const { id } = await seedSiteWithKey();
    const result = await ingest.ingestEvent(id, {
      type: "purchase",
      displayName: "Mike Jones",
      city: "London",
      product: "Nike Air",
    });
    expect(result).toBe("created");
    const [stored] = await db.select().from(event).where(eq(event.siteId, id));
    expect(stored?.displayName).toBe("Mike");
    expect(stored?.city).toBe("London");
    expect(stored?.source).toBe("manual");
    expect(stored?.verified).toBe(false);
    const payload = stored?.payload as { product?: string } | null;
    expect(payload?.product).toBe("Nike Air");
  });

  it("rejects duplicate events by dedupeKey", async () => {
    const { id } = await seedSiteWithKey();
    const first = await ingest.ingestEvent(id, { type: "purchase", dedupeKey: "order-1" });
    const second = await ingest.ingestEvent(id, { type: "purchase", dedupeKey: "order-1" });
    expect(first).toBe("created");
    expect(second).toBe("duplicate");
    const rows = await db.select().from(event).where(eq(event.siteId, id));
    expect(rows).toHaveLength(1);
  });

  async function seedWithIntegration(secret: string, provider = "webhook") {
    const created = await sites.create("org-a", { name: "Shop", domain: "shop.example.com" });
    const [row] = await db.select().from(site).where(eq(site.id, created.id));
    await db
      .insert(schema.integration)
      .values({ organizationId: "org-a", provider, config: { secret } });
    return { siteKey: row!.siteKey, siteId: created.id };
  }

  const hex = (body: string, secret: string) =>
    createHmac("sha256", secret).update(body).digest("hex");
  const b64 = (body: string, secret: string) =>
    createHmac("sha256", secret).update(body).digest("base64");

  it("rejects a webhook with a bad signature", async () => {
    const { siteKey } = await seedWithIntegration("supersecret");
    const body = JSON.stringify({ type: "purchase", name: "Mike Jones", city: "London" });
    const result = await ingest.processWebhook({
      siteKey,
      provider: "webhook",
      rawBody: body,
      headers: { "x-tacto-signature": "deadbeef" },
    });
    expect(result).toBe("unauthorized");
  });

  it("creates a verified event from a signed custom webhook", async () => {
    const { siteKey, siteId } = await seedWithIntegration("supersecret");
    const body = JSON.stringify({
      type: "purchase",
      name: "Mike Jones",
      city: "London",
      product: "Nike Air",
    });
    const result = await ingest.processWebhook({
      siteKey,
      provider: "webhook",
      rawBody: body,
      headers: { "x-tacto-signature": hex(body, "supersecret") },
    });
    expect(result).toBe("created");
    const [stored] = await db.select().from(event).where(eq(event.siteId, siteId));
    expect(stored?.verified).toBe(true);
    expect(stored?.source).toBe("webhook");
    expect(stored?.displayName).toBe("Mike");
  });

  it("verifies and maps a Stripe checkout.session.completed event", async () => {
    const secret = "whsec_test";
    const { siteKey, siteId } = await seedWithIntegration(secret, "stripe");
    const body = JSON.stringify({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_1",
          customer_details: { name: "Jane Doe", address: { city: "Berlin" } },
          metadata: { product: "Pro plan" },
        },
      },
    });
    const ts = Math.floor(Date.now() / 1000);
    const v1 = hex(`${ts}.${body}`, secret);
    const result = await ingest.processWebhook({
      siteKey,
      provider: "stripe",
      rawBody: body,
      headers: { "stripe-signature": `t=${ts},v1=${v1}` },
    });
    expect(result).toBe("created");
    const [stored] = await db.select().from(event).where(eq(event.siteId, siteId));
    expect(stored?.source).toBe("stripe");
    expect(stored?.verified).toBe(true);
    expect(stored?.displayName).toBe("Jane");
    expect(stored?.city).toBe("Berlin");
  });

  it("verifies and maps a Shopify order webhook (base64 HMAC)", async () => {
    const secret = "shpss_test";
    const { siteKey, siteId } = await seedWithIntegration(secret, "shopify");
    const body = JSON.stringify({
      id: 123,
      customer: { first_name: "Ola Nordmann" },
      billing_address: { city: "Oslo" },
      line_items: [{ title: "Sneakers" }],
    });
    const result = await ingest.processWebhook({
      siteKey,
      provider: "shopify",
      rawBody: body,
      headers: { "x-shopify-hmac-sha256": b64(body, secret) },
    });
    expect(result).toBe("created");
    const [stored] = await db.select().from(event).where(eq(event.siteId, siteId));
    expect(stored?.source).toBe("shopify");
    expect(stored?.displayName).toBe("Ola");
    expect(stored?.city).toBe("Oslo");
  });

  it("verifies and maps a WooCommerce order webhook (base64 HMAC)", async () => {
    const secret = "wc_test";
    const { siteKey, siteId } = await seedWithIntegration(secret, "woocommerce");
    const body = JSON.stringify({
      id: 55,
      billing: { first_name: "Marco Rossi", city: "Rome" },
      line_items: [{ name: "Espresso Cups" }],
    });
    const result = await ingest.processWebhook({
      siteKey,
      provider: "woocommerce",
      rawBody: body,
      headers: { "x-wc-webhook-signature": b64(body, secret) },
    });
    expect(result).toBe("created");
    const [stored] = await db.select().from(event).where(eq(event.siteId, siteId));
    expect(stored?.source).toBe("woocommerce");
    expect(stored?.displayName).toBe("Marco");
    expect(stored?.city).toBe("Rome");
  });
});
