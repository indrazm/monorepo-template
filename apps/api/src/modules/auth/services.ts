import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { sign, verify } from "hono/jwt";
import { type Role, type User, prisma } from "../../utils/prisma";
import { hashPassword, verifyPassword } from "./password";
import type { AuthPayload } from "./types";

const authCookieName = "auth_token";
const authMaxAgeSeconds = 60 * 60 * 24 * 7;
const authSecret = process.env.AUTH_SECRET ?? "dev-change-me";
const authCookieSecure = process.env.AUTH_COOKIE_SECURE === "true";

export async function authenticateUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return null;
  }

  return user;
}

export async function createUserAccount(input: {
  email: string;
  password: string;
  name: string | null;
}) {
  return prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash: await hashPassword(input.password),
      role: "USER",
    },
  });
}

export async function getCurrentUser(c: Context) {
  const token = getCookie(c, authCookieName);

  if (!token) {
    return null;
  }

  try {
    const payload = (await verify(token, authSecret, "HS256")) as AuthPayload;

    if (!payload.sub) {
      return null;
    }

    return prisma.user.findUnique({ where: { id: payload.sub } });
  } catch {
    return null;
  }
}

export async function requireRole(c: Context, role: Role) {
  const user = await getCurrentUser(c);

  if (!user || user.role !== role) {
    return null;
  }

  return user;
}

export async function setAuthCookie(c: Context, user: User) {
  const now = Math.floor(Date.now() / 1000);
  const token = await sign(
    {
      sub: user.id,
      role: user.role,
      iat: now,
      exp: now + authMaxAgeSeconds,
    },
    authSecret,
    "HS256",
  );

  setCookie(c, authCookieName, token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: authCookieSecure,
    path: "/",
    maxAge: authMaxAgeSeconds,
  });
}

export function clearAuthCookie(c: Context) {
  deleteCookie(c, authCookieName, {
    path: "/",
  });
}
