import { and, eq } from "drizzle-orm";
import type { Context, Next } from "hono";
import type { Database } from "@repo/db";
import { member } from "@repo/db/schema";
import type { AuthSession, AuthUser } from "./auth";

// Roles inside an organization, from Better Auth's `member.role`.
export const organizationRoles = ["owner", "admin", "member"] as const;
export type OrganizationRole = (typeof organizationRoles)[number];

export type AuthVariables = {
  session: AuthSession | null;
  user: AuthUser | null;
  organizationId: string | null;
  // The caller's role in the active organization (FR-AUTH-05).
  organizationRole: OrganizationRole | null;
};
export type AuthProvider = {
  getSession: (headers: Headers) => Promise<{ session: AuthSession; user: AuthUser } | null>;
  handler: (request: Request) => Promise<Response>;
};

// Resolves the caller's session. Deliberately does no organization lookup:
// routes like /profile and /users never need one, and this runs on every
// authenticated request.
export function createSessionMiddleware(auth: AuthProvider, db: Pick<Database, "select">) {
  return async (c: Context<{ Variables: AuthVariables }>, next: Next) => {
    const session = await auth.getSession(c.req.raw.headers);
    c.set("session", session?.session ?? null);
    c.set("user", session?.user ?? null);
    c.set("organizationId", null);
    c.set("organizationRole", null);
    await next();
  };
}

// Resolves the active organization and the caller's role in it. Mounted on the
// tenant-scoped API only. The membership row is the authority: a session whose
// `activeOrganizationId` points at an organization the user does not belong to
// grants nothing (NFR-SEC-03).
export function createMembershipMiddleware(db: Pick<Database, "select">) {
  return async (c: Context<{ Variables: AuthVariables }>, next: Next) => {
    const session = c.get("session");
    const user = c.get("user");
    if (session && user) {
      const membership = await resolveMembership(db, { session, user });
      c.set("organizationId", membership?.organizationId ?? null);
      c.set("organizationRole", membership?.role ?? null);
    }
    await next();
  };
}

// Prefer the session's active organization; otherwise fall back to the user's
// first membership (every user owns at least one org from sign-up, F14). The
// role is read from the same membership row, so it always matches the org the
// request is scoped to.
async function resolveMembership(
  db: Pick<Database, "select">,
  session: { session: AuthSession; user: AuthUser },
): Promise<{ organizationId: string; role: OrganizationRole } | null> {
  const active = (session.session as { activeOrganizationId?: string | null }).activeOrganizationId;
  if (active) {
    const [row] = await db
      .select({ role: member.role })
      .from(member)
      .where(and(eq(member.userId, session.user.id), eq(member.organizationId, active)))
      .limit(1);
    // An active org the user is not a member of grants nothing.
    if (!row) return null;
    return { organizationId: active, role: normalizeRole(row.role) };
  }
  const [row] = await db
    .select({ organizationId: member.organizationId, role: member.role })
    .from(member)
    .where(eq(member.userId, session.user.id))
    .limit(1);
  return row ? { organizationId: row.organizationId, role: normalizeRole(row.role) } : null;
}

// Better Auth stores the role as free text; anything unrecognized is treated as
// the least-privileged role.
function normalizeRole(value: string | null | undefined): OrganizationRole {
  const role = (value ?? "").trim().toLowerCase();
  if (role === "owner") return "owner";
  if (role === "admin") return "admin";
  return "member";
}

export function getAdminUser(c: Context<{ Variables: AuthVariables }>) {
  const user = c.get("user");
  return user?.role?.split(",").includes("admin") ? user : null;
}

// Returns the active organization id for an authenticated request, or null when
// the request is unauthenticated / has no organization.
export function requireOrg(c: Context<{ Variables: AuthVariables }>) {
  return c.get("organizationId");
}

// Returns the organization id only when the caller holds one of the given roles
// (FR-AUTH-05, NFR-SEC-03). Used to keep billing, site and connection changes
// away from plain members, who can still run the day-to-day notification work.
export function requireRole(
  c: Context<{ Variables: AuthVariables }>,
  ...roles: OrganizationRole[]
): { organizationId: string } | { error: "unauthorized" | "forbidden" } {
  const organizationId = c.get("organizationId");
  if (!organizationId) return { error: "unauthorized" };
  const role = c.get("organizationRole");
  if (!role || !roles.includes(role)) return { error: "forbidden" };
  return { organizationId };
}

// The roles allowed to change billing, sites and integrations.
export const MANAGER_ROLES: OrganizationRole[] = ["owner", "admin"];
