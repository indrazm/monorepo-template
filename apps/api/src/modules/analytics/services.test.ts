import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@repo/db/schema";
import { event, impression } from "@repo/db/schema";
import { createAnalyticsService, InvalidEventsCursorError } from "./services";
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

  it("reports the onboarding activation funnel (F70)", async () => {
    const site = await sites.create(ORG, { name: "Shop", domain: "shop.example.com" });
    const before = await analytics.activation(ORG, site.id);
    expect(before).toMatchObject({ hasPixel: false, activated: false, impressionCount: 0 });
    expect(before?.msToActivation).toBeNull();

    await db
      .update(schema.site)
      .set({ pixelVerifiedAt: new Date() })
      .where(eq(schema.site.id, site.id));
    await db.insert(impression).values({ siteId: site.id, refId: "n1", kind: "view" });

    const after = await analytics.activation(ORG, site.id);
    expect(after?.hasPixel).toBe(true);
    expect(after?.activated).toBe(true);
    expect(after?.impressionCount).toBe(1);
    expect(after?.firstImpressionAt).not.toBeNull();
    expect(after?.msToActivation).toBeGreaterThanOrEqual(0);

    expect(await analytics.activation("org-b", site.id)).toBeNull();
  });

  it("paginates the events feed with a keyset cursor (FR-ING-11)", async () => {
    const site = await sites.create(ORG, { name: "Shop", domain: "shop.example.com" });
    const base = Date.now();
    await db.insert(event).values([
      { siteId: site.id, type: "purchase", source: "manual", occurredAt: new Date(base) },
      { siteId: site.id, type: "purchase", source: "manual", occurredAt: new Date(base + 1000) },
      { siteId: site.id, type: "purchase", source: "manual", occurredAt: new Date(base + 2000) },
    ]);

    const first = await analytics.eventsFeed(ORG, site.id, 2);
    expect(first?.events).toHaveLength(2);
    expect(first?.nextCursor).toBeTruthy();

    const second = await analytics.eventsFeed(ORG, site.id, 2, first?.nextCursor ?? undefined);
    expect(second?.events).toHaveLength(1);
    expect(second?.nextCursor).toBeNull();

    await expect(analytics.eventsFeed(ORG, site.id, 2, "missing")).rejects.toBeInstanceOf(
      InvalidEventsCursorError,
    );
  });
});
