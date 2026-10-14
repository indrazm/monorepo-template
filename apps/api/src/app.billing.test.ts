import { createHmac } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { subscription } from "@repo/db/schema";
import * as schema from "@repo/db/schema";
import { createApp } from "./app";

const client = new PGlite();
const db = drizzle({ client, schema });
const WEBHOOK_SECRET = "whsec_test_123";
const app = createApp({
  db,
  config: {
    clientOrigins: ["http://localhost:3000"],
    stripe: { secretKey: "sk_test_x", webhookSecret: WEBHOOK_SECRET },
  },
  auth: {
    getSession: async () => null,
    handler: async () => new Response(null, { status: 404 }),
  },
});

function stripeSign(body: string): string {
  const ts = Math.floor(Date.now() / 1000);
  const v1 = createHmac("sha256", WEBHOOK_SECRET).update(`${ts}.${body}`).digest("hex");
  return `t=${ts},v1=${v1}`;
}

describe("Stripe billing webhook (HTTP)", () => {
  beforeAll(async () => {
    await migrate(db, {
      migrationsFolder: fileURLToPath(new URL("../../../packages/db/drizzle", import.meta.url)),
    });
    await db.insert(subscription).values({ organizationId: "org-x", plan: "free" });
  });
  afterAll(async () => {
    await client.close();
  });

  it("upgrades the plan on a signed checkout.session.completed", async () => {
    const body = JSON.stringify({
      type: "checkout.session.completed",
      data: { object: { metadata: { organizationId: "org-x", plan: "growth" } } },
    });
    const response = await app.request("/api/v1/billing/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": stripeSign(body) },
      body,
    });
    expect(response.status).toBe(200);
    const [row] = await db
      .select()
      .from(subscription)
      .where(eq(subscription.organizationId, "org-x"));
    expect(row?.plan).toBe("growth");
    expect(row?.trafficQuota).toBe(100_000);
  });

  it("rejects a webhook with an invalid signature", async () => {
    const body = JSON.stringify({ type: "checkout.session.completed", data: { object: {} } });
    const response = await app.request("/api/v1/billing/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": "t=1,v1=bad" },
      body,
    });
    expect(response.status).toBe(401);
  });
});
