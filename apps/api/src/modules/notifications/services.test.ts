import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { NotificationConfig } from "@repo/contracts/notifications";
import * as schema from "@repo/db/schema";
import { createNotificationsService } from "./services";
import { createSitesService } from "../sites/services";

const client = new PGlite();
const db = drizzle({ client, schema });
const notifications = createNotificationsService(db);
const sites = createSitesService(db);

const ORG_A = "org-a";
const ORG_B = "org-b";

const config: NotificationConfig = {
  message: { template: "{{first_name}} just bought {{product}}", fallbacks: {} },
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
};

describe("notifications service", () => {
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

  it("creates a notification and round-trips its config", async () => {
    const site = await sites.create(ORG_A, { name: "A", domain: "a.example.com" });
    const created = await notifications.create(ORG_A, {
      siteId: site.id,
      name: "Recent sales",
      type: "recent_sales",
      isActive: true,
      config,
    });
    expect(created?.config.message.template).toContain("{{product}}");
    expect(created?.config.style.accent).toBe("#3B82F6");
    expect(created?.isActive).toBe(true);
  });

  it("refuses to create against another org's site", async () => {
    const site = await sites.create(ORG_A, { name: "A", domain: "a.example.com" });
    const created = await notifications.create(ORG_B, {
      siteId: site.id,
      name: "x",
      type: "custom",
      isActive: true,
      config,
    });
    expect(created).toBeNull();
  });

  it("scopes list/get/update/remove to the owning org", async () => {
    const site = await sites.create(ORG_A, { name: "A", domain: "a.example.com" });
    const created = await notifications.create(ORG_A, {
      siteId: site.id,
      name: "n",
      type: "custom",
      isActive: true,
      config,
    });
    const id = created!.id;

    expect(await notifications.list(ORG_B, site.id)).toBeNull();
    expect(await notifications.get(ORG_B, id)).toBeNull();
    expect(await notifications.update(ORG_B, id, { name: "hijack" })).toBeNull();
    expect(await notifications.remove(ORG_B, id)).toBe(false);

    const toggled = await notifications.update(ORG_A, id, { isActive: false });
    expect(toggled?.isActive).toBe(false);
    expect((await notifications.list(ORG_A, site.id))?.length).toBe(1);
  });
});
