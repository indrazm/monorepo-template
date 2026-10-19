import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@repo/db/schema";
import { createCredentialCipher } from "./credentials";
import { createIntegrationsService } from "./services";

const client = new PGlite();
const db = drizzle({ client, schema });
const cipher = createCredentialCipher("test-credentials-secret");
const service = createIntegrationsService(db, {
  cipher,
  publicApiUrl: "https://api.tacto.test",
  server: { shopify: null, hubspot: null },
});

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
    expect(created.secretSet).toBe(true);
    const revealed = await service.revealSecret("org-a", created.id);
    expect(revealed?.secret.length).toBeGreaterThanOrEqual(32);
    // A fresh connection has not proven itself yet (FR-INT-04).
    expect(created.status).toBe("pending");
  });

  it("does not mint a secret for providers that sign with their own", async () => {
    const created = await service.create("org-a", { provider: "stripe", config: {} });
    expect(created.secretSet).toBe(false);
    expect(created.status).toBe("pending");
  });

  it("never returns the signing secret in list responses", async () => {
    const created = await service.create("org-a", { provider: "webhook", config: {} });
    const listed = (await service.list("org-a")).find((row) => row.id === created.id);
    expect(listed?.secretSet).toBe(true);
    expect(listed?.config).not.toHaveProperty("secret");
    expect(await service.revealSecret("org-b", created.id)).toBeNull();
  });

  it("lists and scopes delete to the owning org", async () => {
    const created = await service.create("org-a", { provider: "webhook", config: {} });
    expect((await service.list("org-a")).length).toBe(1);
    expect(await service.remove("org-b", created.id)).toBe(false); // wrong org
    expect(await service.remove("org-a", created.id)).toBe(true);
    expect((await service.list("org-a")).length).toBe(0);
  });

  it("stores credentials encrypted and never returns them", async () => {
    const created = await service.create("org-a", {
      provider: "shopify",
      config: {
        credentials: { shopDomain: "demo.myshopify.com", adminAccessToken: "shpat_secret" },
      },
    });
    expect(created.credentialKeys.sort()).toEqual(["adminAccessToken", "shopDomain"]);
    expect(JSON.stringify(created)).not.toContain("shpat_secret");

    const [row] = await db.select().from(schema.integration);
    const stored = (row?.config ?? {}) as { credentials?: Record<string, string> };
    expect(stored.credentials?.adminAccessToken).not.toContain("shpat_secret");
    // …but the server can read it back.
    const resolved = await service.resolveForWebhook("org-a", "shopify");
    expect(resolved?.credentials.adminAccessToken).toBe("shpat_secret");
  });

  it("merges wizard patches and resets status when credentials change", async () => {
    const created = await service.create("org-a", { provider: "stripe", config: {} });
    await service.recordDelivery(created.id, { ok: true });
    expect((await service.list("org-a"))[0]?.status).toBe("connected");

    const updated = await service.update("org-a", created.id, {
      config: { secret: "whsec_pasted_secret", mapping: { city: "data.object.city" } },
    });
    expect(updated?.status).toBe("pending");
    expect(updated?.config.mapping?.city).toBe("data.object.city");

    // A later patch keeps the earlier mapping.
    const again = await service.update("org-a", created.id, {
      config: { events: ["purchase"] },
    });
    expect(again?.config.mapping?.city).toBe("data.object.city");
    expect(again?.config.events).toEqual(["purchase"]);
  });

  it("records delivery failures as connection health", async () => {
    const created = await service.create("org-a", { provider: "webhook", config: {} });
    await service.recordDelivery(created.id, { ok: false, error: "Signature check failed" });
    const [row] = await service.list("org-a");
    expect(row?.status).toBe("error");
    expect(row?.lastError).toContain("Signature check failed");
  });

  it("reports which credentials are missing when verifying", async () => {
    const created = await service.create("org-a", { provider: "shopify", config: {} });
    const result = await service.verify("org-a", created.id);
    expect(result?.status).toBe("error");
    expect(result?.message).toContain("Shop domain");
  });

  it("tells a passive provider to send a test delivery", async () => {
    const created = await service.create("org-a", { provider: "wix", config: {} });
    await service.update("org-a", created.id, { config: { secret: "wix_secret_value" } });
    const result = await service.verify("org-a", created.id);
    expect(result?.status).toBe("pending");
    expect(result?.message).toContain("Waiting for the first signed delivery");
  });
});
