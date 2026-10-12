import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@repo/db/schema";
import { createSitesService } from "./services";

const client = new PGlite();
const db = drizzle({ client, schema });
const service = createSitesService(db);

const ORG_A = "org-a";
const ORG_B = "org-b";

describe("sites service (tenant isolation)", () => {
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

  it("creates a site with a generated siteKey scoped to the org", async () => {
    const created = await service.create(ORG_A, { name: "Shop", domain: "shop.example.com" });
    expect(created.id).toBeTruthy();
    expect(created.siteKey).toBeTruthy();
    expect(created.pixelVerifiedAt).toBeNull();
  });

  it("lists only sites belonging to the organization", async () => {
    await service.create(ORG_A, { name: "A1", domain: "a1.example.com" });
    await service.create(ORG_A, { name: "A2", domain: "a2.example.com" });
    await service.create(ORG_B, { name: "B1", domain: "b1.example.com" });

    const aSites = await service.list(ORG_A);
    const bSites = await service.list(ORG_B);

    expect(aSites.map((s) => s.name).sort()).toEqual(["A1", "A2"]);
    expect(bSites.map((s) => s.name)).toEqual(["B1"]);
  });

  it("never reads, updates, or deletes another org's site", async () => {
    const siteA = await service.create(ORG_A, { name: "A", domain: "a.example.com" });

    expect(await service.get(ORG_B, siteA.id)).toBeNull();
    expect(await service.update(ORG_B, siteA.id, { name: "hijacked" })).toBeNull();
    expect(await service.remove(ORG_B, siteA.id)).toBe(false);

    // Still intact for the owner.
    expect(await service.get(ORG_A, siteA.id)).toMatchObject({ name: "A" });
  });

  it("updates and deletes within the owning org", async () => {
    const siteA = await service.create(ORG_A, { name: "A", domain: "a.example.com" });
    const updated = await service.update(ORG_A, siteA.id, { name: "A renamed" });
    expect(updated?.name).toBe("A renamed");
    expect(await service.remove(ORG_A, siteA.id)).toBe(true);
    expect(await service.get(ORG_A, siteA.id)).toBeNull();
  });
});
