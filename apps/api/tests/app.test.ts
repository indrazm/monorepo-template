import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import { ProfileNotFoundError, type ProfileService } from "../src/modules/profile/services";
import { InvalidUsersCursorError, type UsersService } from "../src/modules/users/services";

const mocks = {
  authHandler: vi.fn(),
  getSession: vi.fn(),
  listRecentUsers: vi.fn<UsersService["listRecentUsers"]>(),
  updateProfile: vi.fn<ProfileService["updateProfile"]>(),
};

const app = createApp({
  auth: { getSession: mocks.getSession, handler: mocks.authHandler },
  config: { clientOrigins: ["http://localhost:3000"] },
  services: {
    profile: { updateProfile: mocks.updateProfile },
    users: { listRecentUsers: mocks.listRecentUsers },
  },
});

const baseDate = new Date("2026-07-03T00:00:00.000Z");

describe("api app", () => {
  beforeEach(() => {
    mocks.authHandler.mockReset();
    mocks.getSession.mockReset();
    mocks.listRecentUsers.mockReset();
    mocks.updateProfile.mockReset();

    mocks.authHandler.mockResolvedValue(new Response(null, { status: 404 }));
    mocks.getSession.mockResolvedValue(null);
  });

  it("returns health status without loading a session", async () => {
    const response = await app.request("/health");

    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: "api",
    });
    expect(response.status).toBe(200);
    expect(mocks.getSession).not.toHaveBeenCalled();
  });

  it("delegates Better Auth routes without loading a session", async () => {
    mocks.authHandler.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    const response = await app.request("/api/auth/get-session");

    expect(response.status).toBe(200);
    expect(mocks.authHandler).toHaveBeenCalledTimes(1);
    expect(mocks.getSession).not.toHaveBeenCalled();
  });

  it("returns unauthorized when a session is missing", async () => {
    const response = await app.request("/session");

    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
    expect(response.status).toBe(401);
  });

  it("returns the active session and user", async () => {
    const authSession = createAuthSession("user");
    mocks.getSession.mockResolvedValue(authSession);

    const response = await app.request("/session");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      session: { id: "session-id" },
      user: { id: "auth-user-id", role: "user" },
    });
  });

  it("forbids users access without an admin session", async () => {
    const response = await app.request("/users");

    await expect(response.json()).resolves.toEqual({ error: "forbidden" });
    expect(response.status).toBe(403);
    expect(mocks.listRecentUsers).not.toHaveBeenCalled();
  });

  it("validates users list limits", async () => {
    mocks.getSession.mockResolvedValue(createAuthSession("admin"));

    const response = await app.request("/users?limit=0");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "validation_error" });
    expect(mocks.listRecentUsers).not.toHaveBeenCalled();
  });

  it("returns paginated users for admins with validated query input", async () => {
    mocks.getSession.mockResolvedValue(createAuthSession("admin"));
    mocks.listRecentUsers.mockResolvedValue({
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

    const response = await app.request("/users?cursor=user-3&limit=1");

    expect(response.status).toBe(200);
    expect(mocks.listRecentUsers).toHaveBeenCalledWith({ cursor: "user-3", limit: 1 });
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
  });

  it("maps invalid user cursors to invalid_cursor", async () => {
    mocks.getSession.mockResolvedValue(createAuthSession("admin"));
    mocks.listRecentUsers.mockRejectedValue(new InvalidUsersCursorError());

    const response = await app.request("/users?cursor=missing");

    await expect(response.json()).resolves.toEqual({ error: "invalid_cursor" });
    expect(response.status).toBe(400);
    expect(mocks.listRecentUsers).toHaveBeenCalledWith({ cursor: "missing", limit: 20 });
  });

  it("requires a session to update profile", async () => {
    const response = await app.request("/profile", {
      body: JSON.stringify({ name: "Updated User" }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });

    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
    expect(response.status).toBe(401);
    expect(mocks.updateProfile).not.toHaveBeenCalled();
  });

  it("passes normalized input and strips disallowed fields when updating profile", async () => {
    mocks.getSession.mockResolvedValue(createAuthSession("user"));
    mocks.updateProfile.mockResolvedValue({
      user: createProfileUser("https://example.com/new-avatar.png"),
    });

    const response = await app.request("/profile", {
      body: JSON.stringify({
        email: "takeover@example.com",
        image: "https://example.com/new-avatar.png",
        name: "  Updated User  ",
        role: "admin",
      }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });

    expect(response.status).toBe(200);
    expect(mocks.updateProfile).toHaveBeenCalledWith("auth-user-id", {
      image: "https://example.com/new-avatar.png",
      name: "Updated User",
    });
    await expect(response.json()).resolves.toEqual({
      user: createProfileUser("https://example.com/new-avatar.png"),
    });
  });

  it("converts blank profile images to null and omits missing images", async () => {
    mocks.getSession.mockResolvedValue(createAuthSession("user"));
    mocks.updateProfile.mockResolvedValue({ user: createProfileUser(null) });

    const cleared = await app.request("/profile", {
      body: JSON.stringify({ image: " ", name: "Updated User" }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });

    expect(cleared.status).toBe(200);
    expect(mocks.updateProfile).toHaveBeenLastCalledWith("auth-user-id", {
      image: null,
      name: "Updated User",
    });

    const omitted = await app.request("/profile", {
      body: JSON.stringify({ name: "Updated User" }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });

    expect(omitted.status).toBe(200);
    expect(mocks.updateProfile).toHaveBeenLastCalledWith("auth-user-id", {
      name: "Updated User",
    });
  });

  it("rejects invalid profile payloads before calling the service", async () => {
    mocks.getSession.mockResolvedValue(createAuthSession("user"));

    const invalidProtocol = await app.request("/profile", {
      body: JSON.stringify({ image: "ftp://example.com/avatar.png", name: "" }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    expect(invalidProtocol.status).toBe(400);
    await expect(invalidProtocol.json()).resolves.toEqual({ error: "validation_error" });

    const malformedUrl = await app.request("/profile", {
      body: JSON.stringify({ image: "invalid", name: "User" }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    expect(malformedUrl.status).toBe(400);
    await expect(malformedUrl.json()).resolves.toEqual({ error: "validation_error" });
    expect(mocks.updateProfile).not.toHaveBeenCalled();
  });

  it("maps missing profile records to user_not_found", async () => {
    mocks.getSession.mockResolvedValue(createAuthSession("user"));
    mocks.updateProfile.mockRejectedValue(new ProfileNotFoundError());

    const response = await app.request("/profile", {
      body: JSON.stringify({ name: "User" }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "user_not_found" });
  });
});

function createAuthSession(role: string) {
  return {
    session: {
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

function createProfileUser(image: string | null) {
  return {
    createdAt: baseDate.toISOString(),
    email: "auth-user-id@example.com",
    emailVerified: true,
    id: "auth-user-id",
    image,
    name: "Updated User",
    role: "user",
    updatedAt: baseDate.toISOString(),
  };
}
