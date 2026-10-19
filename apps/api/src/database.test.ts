import { fileURLToPath } from "node:url";
import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app";
import { createAuth } from "./modules/auth/auth";
import { createProfileService } from "./modules/profile/services";
import { InvalidUsersCursorError, createUsersService } from "./modules/users/services";
import { account, session, user, verification } from "@repo/db/schema";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@repo/db/schema";
import { createApiConfig, parseApiEnv } from "./config";

const client = new PGlite();
const db = drizzle({ client, schema });

const sentEmails: { to: string; subject: string; text: string }[] = [];
const mailer = {
  send: async (message: { to: string; subject: string; text: string }) => {
    sentEmails.push(message);
  },
};

const config = createApiConfig(parseApiEnv({ NODE_ENV: "test" }));
const auth = createAuth(db, config.auth, mailer);
const app = createApp({
  auth: {
    getSession: (headers) => auth.api.getSession({ headers }),
    handler: (request) => auth.handler(request),
  },
  db,
  config: {
    metricsToken: null,
    clientOrigins: ["http://localhost:3000"],
    stripe: {
      secretKey: null,
      webhookSecret: null,
      prices: {
        starter: { month: null, year: null },
        growth: { month: null, year: null },
        agency: { month: null, year: null },
      },
      trialDays: 0,
    },
    publicApiUrl: "http://localhost:8000",
    credentialsSecret: "test-credentials-secret",
    media: { staticMapTemplate: null },
    integrations: { shopify: null, hubspot: null },
    reviews: { googlePlacesApiKey: null, facebookPageToken: null },
    social: { youtubeApiKey: null },
  },
});
const { updateProfile } = createProfileService(db);
const { listRecentUsers } = createUsersService(db);

const PASSWORD = "password-for-tests";
const DASHBOARD_ORIGIN = "http://localhost:3000";
const VERIFY_CALLBACK = `${DASHBOARD_ORIGIN}/verify-email?verified=1`;
const RESET_REDIRECT = `${DASHBOARD_ORIGIN}/reset-password`;

function lastEmailTo(address: string) {
  return [...sentEmails].reverse().find((message) => message.to === address.toLowerCase());
}

function firstUrl(text: string): string {
  const match = text.match(/https?:\/\/\S+/);
  if (!match) throw new Error(`No URL found in email: ${text}`);
  return match[0];
}

function sessionCookieFrom(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

// Builds a verification JWT exactly like Better Auth's signJWT (HS256 over the
// UTF-8 secret). Lets us deterministically exercise the expired/invalid paths.
function forgeVerificationToken(payload: Record<string, unknown>, secret: string) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const body = encode(payload);
  const signature = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

async function signUp(email: string, callbackURL = VERIFY_CALLBACK) {
  return app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: DASHBOARD_ORIGIN },
    body: JSON.stringify({ email, name: "Test User", password: PASSWORD, callbackURL }),
  });
}

async function signIn(email: string, password = PASSWORD) {
  return app.request("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: DASHBOARD_ORIGIN },
    body: JSON.stringify({ email, password }),
  });
}

// Runs the whole sign-up + email-verification happy path and returns the
// verified user's id.
async function registerAndVerify(email: string): Promise<string> {
  const signedUp = await signUp(email);
  expect(signedUp.status).toBe(200);

  const url = firstUrl(lastEmailTo(email)?.text ?? "");
  const token = new URL(url).searchParams.get("token");
  if (!token) throw new Error("No verification token in email");

  const verified = await app.request(
    `/api/auth/verify-email?token=${encodeURIComponent(token)}&callbackURL=${encodeURIComponent(VERIFY_CALLBACK)}`,
    { headers: { origin: DASHBOARD_ORIGIN } },
  );
  expect(verified.status).toBe(302);

  const [row] = await db.select().from(user).where(eq(user.email, email));
  if (!row) throw new Error("User was not created");
  return row.id;
}

describe("Drizzle database integration", () => {
  beforeAll(async () => {
    await migrate(db, {
      migrationsFolder: fileURLToPath(new URL("../../../packages/db/drizzle", import.meta.url)),
    });
  });

  beforeEach(async () => {
    sentEmails.length = 0;
    await client.exec('TRUNCATE "Account", "Session", "Verification", "User" CASCADE');
  });

  afterAll(async () => {
    await client.close();
  });

  it("requires email verification before sign-in and activates on verify", async () => {
    const email = "verify@example.com";
    const signedUp = await signUp(email);

    expect(signedUp.status).toBe(200);
    // No session is issued while the address is unverified.
    const signUpBody = (await signedUp.json()) as { token: string | null };
    expect(signUpBody.token).toBeNull();
    expect(sessionCookieFrom(signedUp)).toBe("");

    const [unverified] = await db.select().from(user).where(eq(user.email, email));
    expect(unverified?.emailVerified).toBe(false);

    // An activation email is sent with a link back to the API.
    const emailMessage = lastEmailTo(email);
    expect(emailMessage?.subject).toContain("Activate");
    const verificationUrl = firstUrl(emailMessage?.text ?? "");
    expect(verificationUrl).toContain("/api/auth/verify-email?token=");
    const token = new URL(verificationUrl).searchParams.get("token");
    expect(token).toBeTruthy();

    // Sign-in before activation is rejected with a stable, actionable code.
    const blocked = await signIn(email);
    expect(blocked.status).toBe(403);
    await expect(blocked.json()).resolves.toMatchObject({ code: "EMAIL_NOT_VERIFIED" });

    // Opening the link verifies the address and (autoSignIn) starts a session.
    const verified = await app.request(
      `/api/auth/verify-email?token=${encodeURIComponent(token ?? "")}&callbackURL=${encodeURIComponent(VERIFY_CALLBACK)}`,
      { headers: { origin: DASHBOARD_ORIGIN } },
    );
    expect(verified.status).toBe(302);
    expect(verified.headers.get("location")).toBe(VERIFY_CALLBACK);
    expect(sessionCookieFrom(verified)).not.toBe("");

    const [activated] = await db.select().from(user).where(eq(user.email, email));
    expect(activated?.emailVerified).toBe(true);

    // Sign-in now succeeds and the session resolves through the API.
    const signedIn = await signIn(email);
    expect(signedIn.status).toBe(200);
    const sessionResponse = await app.request("/session", {
      headers: { cookie: sessionCookieFrom(signedIn) },
    });
    expect(sessionResponse.status).toBe(200);
    await expect(sessionResponse.json()).resolves.toMatchObject({
      user: { id: activated?.id, email, emailVerified: true },
    });

    const [storedAccount] = await db
      .select()
      .from(account)
      .where(eq(account.userId, activated!.id));
    expect(storedAccount?.password).toBeTruthy();
    expect(storedAccount?.password).not.toBe(PASSWORD);

    await db.delete(user).where(eq(user.id, activated!.id));
    expect(await db.select().from(account)).toEqual([]);
    expect(await db.select().from(session)).toEqual([]);
  });

  it("treats a re-used verification link as an idempotent success", async () => {
    const email = "reuse-verify@example.com";
    await signUp(email);
    const token = new URL(firstUrl(lastEmailTo(email)?.text ?? "")).searchParams.get("token");
    const link = `/api/auth/verify-email?token=${encodeURIComponent(token ?? "")}&callbackURL=${encodeURIComponent(VERIFY_CALLBACK)}`;

    const first = await app.request(link, { headers: { origin: DASHBOARD_ORIGIN } });
    const second = await app.request(link, { headers: { origin: DASHBOARD_ORIGIN } });

    // Verification tokens are stateless JWTs, so a replay stays valid until it
    // expires: it is idempotent rather than a hard single-use.
    expect(first.status).toBe(302);
    expect(second.status).toBe(302);
    const [row] = await db.select().from(user).where(eq(user.email, email));
    expect(row?.emailVerified).toBe(true);
  });

  it("resets a password through the emailed link and rejects reuse", async () => {
    const email = "reset@example.com";
    await registerAndVerify(email);

    // Unknown addresses answer generically (no account enumeration).
    const unknown = await app.request("/api/auth/request-password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json", origin: DASHBOARD_ORIGIN },
      body: JSON.stringify({ email: "nobody@example.com", redirectTo: RESET_REDIRECT }),
    });
    expect(unknown.status).toBe(200);
    await expect(unknown.json()).resolves.toMatchObject({ status: true });

    const requested = await app.request("/api/auth/request-password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json", origin: DASHBOARD_ORIGIN },
      body: JSON.stringify({ email, redirectTo: RESET_REDIRECT }),
    });
    expect(requested.status).toBe(200);

    // The link points at the API, which validates then forwards to the SPA.
    const resetUrl = firstUrl(lastEmailTo(email)?.text ?? "");
    const apiPath = new URL(resetUrl).pathname + new URL(resetUrl).search;
    const forwarded = await app.request(apiPath, { headers: { origin: DASHBOARD_ORIGIN } });
    expect(forwarded.status).toBe(302);
    const location = forwarded.headers.get("location") ?? "";
    expect(location.startsWith(RESET_REDIRECT)).toBe(true);
    const token = new URL(location).searchParams.get("token");
    expect(token).toBeTruthy();

    const newPassword = "a-brand-new-password";
    const reset = await app.request("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json", origin: DASHBOARD_ORIGIN },
      body: JSON.stringify({ token, newPassword }),
    });
    expect(reset.status).toBe(200);

    // New password works, the old one is gone.
    expect((await signIn(email, newPassword)).status).toBe(200);
    expect((await signIn(email, PASSWORD)).status).toBe(401);

    // The token is single-use: replaying it is rejected.
    const replay = await app.request("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json", origin: DASHBOARD_ORIGIN },
      body: JSON.stringify({ token, newPassword: "another-password" }),
    });
    expect(replay.status).toBe(400);
    await expect(replay.json()).resolves.toMatchObject({ code: "INVALID_TOKEN" });
  });

  it("rejects an expired or tampered verification token", async () => {
    const email = "unverified@example.com";
    await signUp(email);

    const nowSeconds = Math.floor(Date.now() / 1000);
    const expired = forgeVerificationToken(
      { email, iat: nowSeconds - 120, exp: nowSeconds - 60 },
      config.auth.secret,
    );
    const expiredResponse = await app.request(
      `/api/auth/verify-email?token=${encodeURIComponent(expired)}&callbackURL=${encodeURIComponent(VERIFY_CALLBACK)}`,
      { headers: { origin: DASHBOARD_ORIGIN } },
    );
    expect(expiredResponse.status).toBe(302);
    expect(expiredResponse.headers.get("location")).toContain("error=TOKEN_EXPIRED");

    const tampered = forgeVerificationToken(
      { email, iat: nowSeconds, exp: nowSeconds + 3600 },
      "not-the-real-secret",
    );
    const tamperedResponse = await app.request(
      `/api/auth/verify-email?token=${encodeURIComponent(tampered)}&callbackURL=${encodeURIComponent(VERIFY_CALLBACK)}`,
      { headers: { origin: DASHBOARD_ORIGIN } },
    );
    expect(tamperedResponse.status).toBe(302);
    expect(tamperedResponse.headers.get("location")).toContain("error=INVALID_TOKEN");

    const [row] = await db.select().from(user).where(eq(user.email, email));
    expect(row?.emailVerified).toBe(false);
  });

  it("rejects an expired password-reset token", async () => {
    const email = "expired@example.com";
    await registerAndVerify(email);

    await app.request("/api/auth/request-password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json", origin: DASHBOARD_ORIGIN },
      body: JSON.stringify({ email, redirectTo: RESET_REDIRECT }),
    });
    const resetUrl = firstUrl(lastEmailTo(email)?.text ?? "");
    const token = new URL(resetUrl).pathname.split("/").pop() ?? "";

    // Force the stored token into the past, then try to use it.
    await db
      .update(verification)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(verification.identifier, `reset-password:${token}`));

    const expired = await app.request("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json", origin: DASHBOARD_ORIGIN },
      body: JSON.stringify({ token, newPassword: "should-not-apply" }),
    });
    expect(expired.status).toBe(400);
    await expect(expired.json()).resolves.toMatchObject({ code: "INVALID_TOKEN" });
  });

  it("creates admin users through Better Auth", async () => {
    const created = await auth.api.createUser({
      body: {
        email: "admin@example.com",
        name: "Admin",
        password: PASSWORD,
        role: "admin",
      },
    });

    const [storedUser] = await db.select().from(user).where(eq(user.id, created.user.id));
    expect(storedUser).toMatchObject({ email: "admin@example.com", role: "admin" });
  });

  it("paginates users with tied timestamps without skipping or repeating users", async () => {
    const createdAt = new Date("2026-07-03T00:00:00.000Z");
    await db.insert(user).values(
      ["user-1", "user-2", "user-3"].map((id) => ({
        id,
        email: `${id}@example.com`,
        name: id,
        createdAt,
      })),
    );

    const first = await listRecentUsers({ limit: 2 });
    const second = await listRecentUsers({ cursor: first.nextCursor ?? undefined, limit: 2 });

    expect(first.users.map((user) => user.id)).toEqual(["user-3", "user-2"]);
    expect(first.nextCursor).toBe("user-2");
    expect(second.users.map((user) => user.id)).toEqual(["user-1"]);
    expect(second.nextCursor).toBeNull();
    await expect(listRecentUsers({ cursor: "missing", limit: 20 })).rejects.toBeInstanceOf(
      InvalidUsersCursorError,
    );
  });

  it("updates profile timestamps, preserves omitted images, and clears explicit null images", async () => {
    const previousUpdate = new Date("2000-01-01T00:00:00.000Z");
    await db.insert(user).values({
      id: "profile-user",
      email: "profile@example.com",
      name: "Original",
      image: "https://example.com/avatar.png",
      updatedAt: previousUpdate,
    });

    const updated = await updateProfile("profile-user", { name: "Updated" });
    expect(updated.user.image).toBe("https://example.com/avatar.png");
    expect(Date.parse(updated.user.updatedAt)).toBeGreaterThan(previousUpdate.getTime());

    const cleared = await updateProfile("profile-user", { name: "Updated", image: null });
    expect(cleared.user.image).toBeNull();
    await expect(updateProfile("missing", { name: "Missing" })).rejects.toThrow("User not found.");
  });
});
