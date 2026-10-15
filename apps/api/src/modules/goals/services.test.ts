import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@repo/db/schema";
import { createGoalsService } from "./services";
import { createSitesService } from "../sites/services";

const client = new PGlite();
const db = drizzle({ client, schema });
const goals = createGoalsService(db);
const sites = createSitesService(db);
const ORG_A = "org-a";
const ORG_B = "org-b";

describe("goals service", () => {
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

  it("records conversions when a pageview URL matches the goal rule", async () => {
    const site = await sites.create(ORG_A, { name: "A", domain: "a.example.com" });
    const created = await goals.create(ORG_A, {
      siteId: site.id,
      name: "Thank you",
      rule: { type: "url", url: { mode: "contains", value: "/thank-you" } },
    });
    expect(created?.conversions).toBe(0);

    await goals.recordConversions(site.siteKey, "/thank-you");
    await goals.recordConversions(site.siteKey, "/thank-you?ref=x");
    await goals.recordConversions(site.siteKey, "/pricing"); // no match

    const list = await goals.list(ORG_A, site.id);
    expect(list?.[0]?.conversions).toBe(2);
  });

  it("scopes list/create/delete to the owning org", async () => {
    const site = await sites.create(ORG_A, { name: "A", domain: "a.example.com" });
    const created = await goals.create(ORG_A, {
      siteId: site.id,
      name: "G",
      rule: { type: "url", url: { mode: "all" } },
    });
    expect(await goals.list(ORG_B, site.id)).toBeNull();
    expect(
      await goals.create(ORG_B, {
        siteId: site.id,
        name: "x",
        rule: { type: "url", url: { mode: "all" } },
      }),
    ).toBeNull();
    expect(await goals.remove(ORG_B, created!.id)).toBe(false);
    expect(await goals.remove(ORG_A, created!.id)).toBe(true);
  });

  it("records event-based conversions and attributes them to viewed notifications", async () => {
    const site = await sites.create(ORG_A, { name: "B", domain: "b.example.com" });
    const created = await goals.create(ORG_A, {
      siteId: site.id,
      name: "Purchases",
      rule: { type: "event", eventType: "purchase" },
    });
    const [notif] = await db
      .insert(schema.notification)
      .values({
        siteId: site.id,
        name: "Sales pop",
        type: "recent_sales",
        message: {},
        style: {},
        display: {},
        dataSource: {},
        timing: {},
      })
      .returning();
    // A view of the notification just before the conversions (default now()).
    await db.insert(schema.impression).values({
      siteId: site.id,
      refId: notif!.id,
      kind: "view",
    });

    await goals.recordEventConversions(site.id, "purchase");
    await goals.recordEventConversions(site.id, "purchase");
    await goals.recordEventConversions(site.id, "signup"); // no matching goal

    const stats = await goals.stats(ORG_A, created!.id, 30, 30);
    expect(stats?.total).toBe(2);
    expect(stats?.attribution[0]?.notificationId).toBe(notif!.id);
    expect(stats?.attribution[0]?.conversions).toBe(2);
    expect(stats?.daily.at(-1)?.conversions).toBe(2);
    // A goal from another org is invisible.
    expect(await goals.stats(ORG_B, created!.id, 30, 30)).toBeNull();
  });
});
