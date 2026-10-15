import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@repo/db/schema";
import { createApp } from "./app";
import type { AuthSession, AuthUser } from "./modules/auth/auth";

// ---------------------------------------------------------------------------
// Role-based access control (FR-AUTH-05, NFR-SEC-03). A plain member can run
// the day-to-day notification work but must not be able to change billing,
// sites or integrations.
// ---------------------------------------------------------------------------

const client = new PGlite();
const db = drizzle({ client, schema });

const ORG = "org-rbac";
let currentUserId = "user-owner";

function app() {
  return createApp({
    db,
    config: {
      clientOrigins: ["http://localhost:3000"],
      stripe: {
        secretKey: "sk_test_x",
        webhookSecret: "whsec_x",
        prices: { starter: "price_x", growth: null, agency: null },
      },
      publicApiUrl: "http://localhost:8000",
      credentialsSecret: "test-credentials-secret",
      media: { staticMapTemplate: null },
      integrations: { googleMapsApiKey: null, shopify: null, hubspot: null },
    },
    auth: {
      // A session for whichever user the test is currently acting as.
      getSession: async () => ({
        session: { id: "s1", userId: currentUserId, activeOrganizationId: ORG } as AuthSession,
        user: { id: currentUserId, email: `${currentUserId}@example.test` } as AuthUser,
      }),
      handler: async () => new Response(null, { status: 404 }),
    },
  });
}

async function seedMember(userId: string, role: string) {
  await db
    .insert(schema.user)
    .values({
      id: userId,
      name: userId,
      email: `${userId}@example.test`,
      updatedAt: new Date(),
    })
    .onConflictDoNothing();
  await db
    .insert(schema.member)
    .values({ id: `m-${userId}`, organizationId: ORG, userId, role })
    .onConflictDoNothing();
}

describe("organization roles", () => {
  beforeAll(async () => {
    await migrate(db, {
      migrationsFolder: fileURLToPath(new URL("../../../packages/db/drizzle", import.meta.url)),
    });
    await db
      .insert(schema.organization)
      .values({ id: ORG, name: "RBAC", slug: "rbac" })
      .onConflictDoNothing();
    await seedMember("user-owner", "owner");
    await seedMember("user-admin", "admin");
    await seedMember("user-member", "member");
  });
  afterAll(async () => {
    await client.close();
  });

  async function as(userId: string, path: string, init?: RequestInit) {
    currentUserId = userId;
    return app().request(path, init);
  }

  const siteBody = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Shop", domain: "shop.example.com" }),
  } satisfies RequestInit;

  it("lets any member read sites", async () => {
    const response = await as("user-member", "/api/v1/sites");
    expect(response.status).toBe(200);
  });

  it("stops a member from creating a site", async () => {
    const response = await as("user-member", "/api/v1/sites", siteBody);
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "forbidden" });
  });

  it("lets an owner create a site", async () => {
    const response = await as("user-owner", "/api/v1/sites", siteBody);
    expect(response.status).toBe(201);
  });

  it("lets an admin change domain settings but not a member", async () => {
    currentUserId = "user-owner";
    const list = await as("user-owner", "/api/v1/sites");
    const { sites } = (await list.json()) as { sites: { id: string }[] };
    const siteId = sites[0]?.id ?? "";
    const settings = {
      loop: { loopAfter: 3, order: "random", manualOrder: [], showClose: true, closeForDays: 1 },
      privacy: {
        requireConsent: false,
        trackIpGeo: true,
        storeEmail: false,
        blockedIps: [],
        filterProfanity: false,
      },
      customCss: null,
      customJs: null,
      analyticsPassthrough: { gtag: false, dataLayer: false, fbq: false, mixpanel: false },
    };
    const put = {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    } satisfies RequestInit;

    expect((await as("user-admin", `/api/v1/sites/${siteId}/settings`, put)).status).toBe(200);
    expect((await as("user-member", `/api/v1/sites/${siteId}/settings`, put)).status).toBe(403);
  });

  it("stops a member from deleting a site", async () => {
    const list = await as("user-owner", "/api/v1/sites");
    const { sites } = (await list.json()) as { sites: { id: string }[] };
    const siteId = sites[0]?.id ?? "";
    const response = await as("user-member", `/api/v1/sites/${siteId}`, { method: "DELETE" });
    expect(response.status).toBe(403);
  });

  it("stops a member from starting a checkout or opening the portal", async () => {
    const checkout = await as("user-member", "/api/v1/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "starter" }),
    });
    expect(checkout.status).toBe(403);
    const portal = await as("user-member", "/api/v1/billing/portal", { method: "POST" });
    expect(portal.status).toBe(403);
  });

  it("stops a member from connecting or removing an integration", async () => {
    const create = await as("user-member", "/api/v1/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "webhook", config: {} }),
    });
    expect(create.status).toBe(403);

    const owned = await as("user-owner", "/api/v1/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "webhook", config: {} }),
    });
    expect(owned.status).toBe(201);
    const { integration } = (await owned.json()) as { integration: { id: string } };

    // A member can still see the connection, just not change it.
    expect((await as("user-member", "/api/v1/integrations")).status).toBe(200);
    expect(
      (await as("user-member", `/api/v1/integrations/${integration.id}`, { method: "DELETE" }))
        .status,
    ).toBe(403);
    expect(
      (await as("user-member", `/api/v1/integrations/${integration.id}/verify`, { method: "POST" }))
        .status,
    ).toBe(403);
  });

  it("grants nothing when the session points at an organization the user is not in", async () => {
    // A user with a session (and an active org id) but no membership row.
    await db
      .insert(schema.user)
      .values({
        id: "user-outsider",
        name: "outsider",
        email: "outsider@example.test",
        updatedAt: new Date(),
      })
      .onConflictDoNothing();
    currentUserId = "user-outsider";
    const response = await app().request("/api/v1/sites");
    expect(response.status).toBe(401);
  });
});
