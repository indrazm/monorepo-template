import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDatabase } from "@repo/db";
import { createApp } from "./app";

const mocks = { authHandler: vi.fn(), databaseQuery: vi.fn(), getSession: vi.fn() };
// The pool is lazy; replacing query prevents any network connection.
const database = createDatabase("postgresql://localhost/test");
database.pool.query = mocks.databaseQuery;
const app = createApp({
  auth: { getSession: mocks.getSession, handler: mocks.authHandler },
  db: database.db,
  config: {
    clientOrigins: ["http://localhost:3000"],
    stripe: { secretKey: null, webhookSecret: null },
    reviewImport: { googlePlacesApiKey: null },
  },
});

const baseDate = new Date("2026-07-03T00:00:00.000Z");
const databaseTimestamp = "2026-07-03 00:00:00.000";

describe("api app", () => {
  beforeEach(() => {
    mocks.authHandler.mockReset();
    mocks.databaseQuery.mockReset();
    mocks.getSession.mockReset();

    mocks.authHandler.mockResolvedValue(new Response(null, { status: 404 }));
    mocks.databaseQuery.mockResolvedValue({ rows: [] });
    mocks.getSession.mockResolvedValue(null);
  });

  it("returns health status", async () => {
    const response = await app.request("/health");

    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: "api",
    });
    expect(response.status).toBe(200);
    expect(mocks.getSession).not.toHaveBeenCalled();
  });

  it("returns unauthorized when a session is missing", async () => {
    const response = await app.request("/session");

    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
    expect(response.status).toBe(401);
  });

  it("forbids users access without an admin session", async () => {
    const response = await app.request("/users");

    await expect(response.json()).resolves.toEqual({ error: "forbidden" });
    expect(response.status).toBe(403);
    expect(mocks.databaseQuery).not.toHaveBeenCalled();
  });

  it("validates users list limits", async () => {
    mocks.getSession.mockResolvedValue(createAuthSession("admin"));

    const response = await app.request("/users?limit=0");

    expect(response.status).toBe(400);
    expect(mocks.databaseQuery).not.toHaveBeenCalled();
  });

  it("returns paginated users for admins", async () => {
    mocks.getSession.mockResolvedValue(createAuthSession("admin"));
    mocks.databaseQuery.mockResolvedValue({
      rows: [
        createUserRow({ id: "user-2", role: null }),
        createUserRow({ id: "user-1", role: "admin" }),
      ],
    });

    const response = await app.request("/users?limit=1");

    await expect(response.json()).resolves.toEqual({
      nextCursor: "user-2",
      users: [
        {
          createdAt: baseDate.toISOString(),
          email: "user-2@example.com",
          id: "user-2",
          name: "User user-2",
          role: null,
          updatedAt: baseDate.toISOString(),
        },
      ],
    });
    expect(response.status).toBe(200);

    const [query, parameters] = mocks.databaseQuery.mock.calls[0] ?? [];
    expect(parameters).toEqual([2]);
    expect(query.text).toContain('order by "User"."createdAt" desc, "User"."id" desc');
  });

  it("returns invalid_cursor for missing user cursors", async () => {
    mocks.getSession.mockResolvedValue(createAuthSession("admin"));

    const response = await app.request("/users?cursor=missing");

    await expect(response.json()).resolves.toEqual({ error: "invalid_cursor" });
    expect(response.status).toBe(400);
    expect(mocks.databaseQuery).toHaveBeenCalledTimes(1);
    expect(mocks.databaseQuery.mock.calls[0]?.[1]).toEqual(["missing", 1]);
  });

  it("requires a session to update profile", async () => {
    const response = await app.request("/profile", {
      body: JSON.stringify({ name: "Updated User" }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });

    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
    expect(response.status).toBe(401);
    expect(mocks.databaseQuery).not.toHaveBeenCalled();
  });

  it("updates the current user's profile", async () => {
    mocks.getSession.mockResolvedValue(createAuthSession("user"));
    mocks.databaseQuery.mockResolvedValue({
      rows: [createProfileRow("https://example.com/new-avatar.png")],
    });

    const response = await app.request("/profile", {
      body: JSON.stringify({
        image: "https://example.com/new-avatar.png",
        name: "  Updated User  ",
      }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });

    await expect(response.json()).resolves.toEqual({
      user: {
        createdAt: baseDate.toISOString(),
        email: "auth-user-id@example.com",
        emailVerified: true,
        id: "auth-user-id",
        image: "https://example.com/new-avatar.png",
        name: "Updated User",
        role: "user",
        updatedAt: baseDate.toISOString(),
      },
    });
    expect(response.status).toBe(200);
    expect(mocks.databaseQuery.mock.calls[0]?.[1]).toEqual([
      "Updated User",
      "https://example.com/new-avatar.png",
      expect.any(String),
      "auth-user-id",
    ]);
    expect(mocks.databaseQuery.mock.calls[0]?.[0].text).toContain('where "User"."id" = $4');
  });

  it("converts an empty profile image to null", async () => {
    mocks.getSession.mockResolvedValue(createAuthSession("user"));
    mocks.databaseQuery.mockResolvedValue({ rows: [createProfileRow(null)] });

    const response = await app.request("/profile", {
      body: JSON.stringify({
        image: " ",
        name: "Updated User",
      }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });

    expect(response.status).toBe(200);
    expect(mocks.databaseQuery.mock.calls[0]?.[1]).toEqual([
      "Updated User",
      null,
      expect.any(String),
      "auth-user-id",
    ]);
    await expect(response.json()).resolves.toMatchObject({ user: { image: null } });
  });

  it("rejects invalid profile input", async () => {
    mocks.getSession.mockResolvedValue(createAuthSession("user"));

    const response = await app.request("/profile", {
      body: JSON.stringify({
        image: "ftp://example.com/avatar.png",
        name: "",
      }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });

    expect(response.status).toBe(400);
    expect(mocks.databaseQuery).not.toHaveBeenCalled();
  });

  it("returns a contract validation error for malformed avatar URLs", async () => {
    mocks.getSession.mockResolvedValue(createAuthSession("user"));
    const response = await app.request("/profile", {
      body: JSON.stringify({ name: "User", image: "invalid" }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "validation_error" });
    expect(mocks.databaseQuery).not.toHaveBeenCalled();
  });

  it("returns not found when the session user's record no longer exists", async () => {
    mocks.getSession.mockResolvedValue(createAuthSession("user"));
    const response = await app.request("/profile", {
      body: JSON.stringify({ name: "User" }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "user_not_found" });
  });

  it("ignores profile fields users are not allowed to change", async () => {
    mocks.getSession.mockResolvedValue(createAuthSession("user"));
    mocks.databaseQuery.mockResolvedValue({ rows: [createProfileRow(null)] });

    const response = await app.request("/profile", {
      body: JSON.stringify({
        email: "takeover@example.com",
        image: null,
        name: "Updated User",
        role: "admin",
      }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });

    expect(response.status).toBe(200);
    expect(mocks.databaseQuery.mock.calls[0]?.[1]).toEqual([
      "Updated User",
      null,
      expect.any(String),
      "auth-user-id",
    ]);
    const query = mocks.databaseQuery.mock.calls[0]?.[0].text;
    const assignments = query.split(" returning ")[0];
    expect(assignments).not.toContain('"email" =');
    expect(assignments).not.toContain('"role" =');
  });

  it("keeps pagination stable when users share a creation timestamp", async () => {
    mocks.getSession.mockResolvedValue(createAuthSession("admin"));
    mocks.databaseQuery
      .mockResolvedValueOnce({ rows: [[databaseTimestamp, "user-2"]] })
      .mockResolvedValueOnce({ rows: [createUserRow({ id: "user-1", role: "user" })] });

    const response = await app.request("/users?cursor=user-2&limit=1");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      users: [{ id: "user-1" }],
      nextCursor: null,
    });
    expect(mocks.databaseQuery.mock.calls[1]?.[1]).toEqual([
      baseDate.toISOString(),
      baseDate.toISOString(),
      "user-2",
      2,
    ]);
    expect(mocks.databaseQuery.mock.calls[1]?.[0].text).toContain(
      '("User"."createdAt" < $1 or ("User"."createdAt" = $2 and "User"."id" < $3))',
    );
  });

  it("preserves the profile image when the update omits it", async () => {
    mocks.getSession.mockResolvedValue(createAuthSession("user"));
    mocks.databaseQuery.mockResolvedValue({
      rows: [createProfileRow("https://example.com/avatar.png")],
    });

    const response = await app.request("/profile", {
      body: JSON.stringify({ name: "Updated User" }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      user: { image: "https://example.com/avatar.png" },
    });
    expect(mocks.databaseQuery.mock.calls[0]?.[1]).toEqual([
      "Updated User",
      expect.any(String),
      "auth-user-id",
    ]);
    expect(mocks.databaseQuery.mock.calls[0]?.[0].text.split(" returning ")[0]).not.toContain(
      '"image" =',
    );
  });
});

function createAuthSession(role: string) {
  return {
    session: {
      activeOrganizationId: "org-auth-user-id",
      createdAt: baseDate,
      expiresAt: baseDate,
      id: "session-id",
      token: "session-token",
      updatedAt: baseDate,
      userId: "auth-user-id",
    },
    user: {
      createdAt: baseDate,
      email: "admin@example.com",
      emailVerified: true,
      id: "auth-user-id",
      image: null,
      name: "Admin User",
      role,
      updatedAt: baseDate,
    },
  };
}

function createUserRow({
  id,
  name = `User ${id}`,
  role,
}: {
  id: string;
  name?: string;
  role: string | null;
}) {
  return [id, `${id}@example.com`, name, role, databaseTimestamp, databaseTimestamp];
}

function createProfileRow(image: string | null) {
  return [
    databaseTimestamp,
    "auth-user-id@example.com",
    true,
    "auth-user-id",
    image,
    "Updated User",
    "user",
    databaseTimestamp,
  ];
}
