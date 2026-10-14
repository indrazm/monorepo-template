import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@repo/db/schema";
import { impression } from "@repo/db/schema";
import { createAnalyticsService } from "./services";
import { createSitesService } from "../sites/services";

const client = new PGlite();
const db = drizzle({ client, schema });
const analytics = createAnalyticsService(db);
const sites = createSitesService(db);

const ORG = "org-a";

describe("analytics service", () => {
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

  it("reports a per-variant breakdown for A/B tests (FR-ANL-04)", async () => {
    const site = await sites.create(ORG, { name: "Shop", domain: "shop.example.com" });
    await db.insert(impression).values([
      { siteId: site.id, refId: "n1", kind: "view", variant: "A" },
      { siteId: site.id, refId: "n1", kind: "view", variant: "A" },
      { siteId: site.id, refId: "n1", kind: "click", variant: "A" },
      { siteId: site.id, refId: "n1", kind: "view", variant: "B" },
      { siteId: site.id, refId: "n1", kind: "view" }, // non-variant impression
    ]);

    const summary = await analytics.summary(ORG, site.id, 7);
    expect(summary).not.toBeNull();
    const byVariant = Object.fromEntries(
      (summary?.variants ?? []).map((variant) => [variant.variantId, variant]),
    );
    expect(byVariant.A).toMatchObject({ views: 2, clicks: 1 });
    expect(byVariant.A?.ctr).toBeCloseTo(0.5);
    expect(byVariant.B).toMatchObject({ views: 1, clicks: 0 });
    expect(summary?.views).toBe(4); // includes the non-variant view
  });
});
