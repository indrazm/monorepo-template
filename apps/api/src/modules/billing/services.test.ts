import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@repo/db/schema";
import { createBillingService } from "./services";
import { createSitesService } from "../sites/services";

const client = new PGlite();
const db = drizzle({ client, schema });
const billing = createBillingService(db);
const sites = createSitesService(db);

describe("billing guard", () => {
  beforeAll(async () => {
    await migrate(db, {
      migrationsFolder: fileURLToPath(
        new URL("../../../../../packages/db/drizzle", import.meta.url),
      ),
    });
  });
  beforeEach(async () => {
    await client.exec('TRUNCATE "site", "subscription" CASCADE');
  });
  afterAll(async () => {
    await client.close();
  });

  it("limits the free plan to a single site", async () => {
    await db.insert(schema.subscription).values({ organizationId: "org-a", plan: "free" });
    expect(await billing.canCreateSite("org-a")).toBe(true);
    await sites.create("org-a", { name: "One", domain: "one.example.com" });
    expect(await billing.canCreateSite("org-a")).toBe(false);
  });

  it("allows more sites on a higher plan", async () => {
    await db.insert(schema.subscription).values({ organizationId: "org-b", plan: "growth" });
    await sites.create("org-b", { name: "One", domain: "one.example.com" });
    await sites.create("org-b", { name: "Two", domain: "two.example.com" });
    expect(await billing.canCreateSite("org-b")).toBe(true); // growth allows 3
  });

  it("reports an overview with plan limits and usage", async () => {
    await db.insert(schema.subscription).values({ organizationId: "org-c", plan: "free" });
    await sites.create("org-c", { name: "One", domain: "one.example.com" });
    const overview = await billing.getOverview("org-c");
    expect(overview.plan).toBe("free");
    expect(overview.maxSites).toBe(1);
    expect(overview.sitesUsed).toBe(1);
    expect(overview.removeBadge).toBe(false);
  });
});
