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

  it("falls back to Free when the subscription is not active", async () => {
    await db.insert(schema.subscription).values({
      organizationId: "org-inactive",
      plan: "growth",
      status: "past_due",
    });
    expect(await billing.getPlan("org-inactive")).toBe("free");
    const overview = await billing.getOverview("org-inactive");
    expect(overview.plan).toBe("growth");
    expect(overview.effectivePlan).toBe("free");
    expect(overview.active).toBe(false);
    expect(overview.maxSites).toBe(1);
    expect(overview.removeBadge).toBe(false);
  });

  it("upserts a subscription when the organization did not have one", async () => {
    await billing.updatePlan({
      organizationId: "org-no-subscription",
      plan: "starter",
      status: "active",
      renewsAt: null,
      customerId: "cus_new",
    });
    expect(await billing.getPlan("org-no-subscription")).toBe("starter");
    expect(await billing.getCustomerId("org-no-subscription")).toBe("cus_new");
  });

  it("captures the provider customer id and flags the plan manageable (FR-BIL-05)", async () => {
    await db.insert(schema.subscription).values({ organizationId: "org-d", plan: "free" });
    expect(await billing.getCustomerId("org-d")).toBeNull();
    expect((await billing.getOverview("org-d")).manageable).toBe(false);

    await billing.updatePlan({
      organizationId: "org-d",
      plan: "starter",
      status: "active",
      renewsAt: null,
      customerId: "cus_123",
    });
    expect(await billing.getCustomerId("org-d")).toBe("cus_123");
    const overview = await billing.getOverview("org-d");
    expect(overview.manageable).toBe(true);
    expect(overview.plan).toBe("starter");
  });
});
