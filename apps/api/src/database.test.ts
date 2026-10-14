import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createAuth } from "./modules/auth/auth";
import { createProfileService } from "./modules/profile/services";
import { InvalidUsersCursorError, createUsersService } from "./modules/users/services";
import { account, session, user } from "@repo/db/schema";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@repo/db/schema";
import { createApiConfig, parseApiEnv } from "./config";

const client = new PGlite();
const db = drizzle({ client, schema });
const auth = createAuth(db, createApiConfig(parseApiEnv({ NODE_ENV: "test" })).auth, {
  send: async () => undefined,
});
const { updateProfile } = createProfileService(db);
const { listRecentUsers } = createUsersService(db);

describe("Drizzle database integration", () => {
  beforeAll(async () => {
    await migrate(db, {
      migrationsFolder: fileURLToPath(new URL("../../../packages/db/drizzle", import.meta.url)),
    });
  });

  beforeEach(async () => {
    await client.exec('TRUNCATE "Account", "Session", "Verification", "User" CASCADE');
  });

  afterAll(async () => {
    await client.close();
  });

  it("supports email signup, password signin, and session lookup", async () => {
    const signedUp = await auth.api.signUpEmail({
      body: { email: "user@example.com", name: "User", password: "password-for-tests" },
    });
    const signedIn = await auth.api.signInEmail({
      body: { email: "user@example.com", password: "password-for-tests" },
      returnHeaders: true,
    });
    const authSession = await auth.api.getSession({
      headers: new Headers({
        cookie: signedIn.headers
          .getSetCookie()
          .map((cookie) => cookie.split(";")[0])
          .join("; "),
      }),
    });

    expect(authSession?.user).toMatchObject({
      id: signedUp.user.id,
      email: "user@example.com",
      role: "user",
    });
    expect(authSession?.session.userId).toBe(signedUp.user.id);
    const [storedAccount] = await db
      .select()
      .from(account)
      .where(eq(account.userId, signedUp.user.id));
    expect(storedAccount?.password).toBeTruthy();
    expect(storedAccount?.password).not.toBe("password-for-tests");
    expect(storedAccount?.createdAt).toBeInstanceOf(Date);
    expect(storedAccount?.updatedAt).toBeInstanceOf(Date);

    await db.delete(user).where(eq(user.id, signedUp.user.id));
    expect(await db.select().from(account)).toEqual([]);
    expect(await db.select().from(session)).toEqual([]);
  });

  it("creates admin users through Better Auth", async () => {
    const created = await auth.api.createUser({
      body: {
        email: "admin@example.com",
        name: "Admin",
        password: "password-for-tests",
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
