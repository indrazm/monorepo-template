import type { Context } from "hono";
import type { User } from "../../utils/prisma";
import type { SanitizedUser } from "./types";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function normalizeName(name: string | null | undefined) {
  const normalized = name?.trim();

  return normalized || null;
}

export function sanitizeUser(user: User): SanitizedUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export function getValidationErrorMessage(error: { issues: Array<{ message: string }> }) {
  return error.issues[0]?.message ?? "invalid request body";
}

export function authValidationHook(
  result: { success: true } | { success: false; error: { issues: Array<{ message: string }> } },
  c: Context,
) {
  if (!result.success) {
    return c.json({ error: getValidationErrorMessage(result.error) }, 400);
  }
}
