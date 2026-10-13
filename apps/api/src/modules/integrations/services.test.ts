import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@repo/db/schema";
import { createIntegrationsService } from "./services";

const client = new PGlite();
const db = drizzle({ client, schema });
const service = createIntegrationsService(db);

describe("integrations service", () => {
  beforeAll(async () => {
    await migrate(db, {
      migrationsFolder: fileURLToPath(
        new URL("../../../../../packages/db/drizzle", import.meta.url),
      ),
    });
  });
  beforeEach(async () => {
    await client.exec('TRUNCATE "integration" CASCADE');
  });
  afterAll(async () => {
    await client.close();
  });

  it("auto-generates a signing secret for a webhook integration", async () => {
    const created = await service.create("org-a", { provider: "webhook", config: {} });
    expect(created.provider).toBe("webhook");
    expect(created.config.secret).toBeTruthy();
    expect((created.config.secret ?? "").length).toBeGreaterThanOrEqual(32);
  });

  it("lists and scopes delete to the owning org", async () => {
    const created = await service.create("org-a", { provider: "webhook", config: {} });
    expect((await service.list("org-a")).length).toBe(1);
    expect(await service.remove("org-b", created.id)).toBe(false); // wrong org
    expect(await service.remove("org-a", created.id)).toBe(true);
    expect((await service.list("org-a")).length).toBe(0);
  });
});
