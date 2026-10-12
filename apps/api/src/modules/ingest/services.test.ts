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

  async function seedWithIntegration(secret: string) {
    const created = await sites.create("org-a", { name: "Shop", domain: "shop.example.com" });
    const [row] = await db.select().from(site).where(eq(site.id, created.id));
    await db
      .insert(schema.integration)
      .values({ organizationId: "org-a", provider: "webhook", config: { secret } });
    return { siteKey: row!.siteKey, siteId: created.id };
  }

  function sign(body: string, secret: string) {
    return createHmac("sha256", secret).update(body).digest("hex");
  }

  it("rejects a webhook with a bad signature", async () => {
    const { siteKey } = await seedWithIntegration("supersecret");
    const body = JSON.stringify({ type: "purchase", name: "Mike Jones", city: "London" });
    const result = await ingest.processWebhook({
      siteKey,
      provider: "webhook",
      rawBody: body,
      signature: "deadbeef",
    });
    expect(result).toBe("unauthorized");
  });

  it("creates a verified event from a signed webhook", async () => {
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
      signature: sign(body, "supersecret"),
    });
    expect(result).toBe("created");
    const [stored] = await db.select().from(event).where(eq(event.siteId, siteId));
    expect(stored?.verified).toBe(true);
    expect(stored?.source).toBe("webhook");
    expect(stored?.displayName).toBe("Mike");
  });
});
