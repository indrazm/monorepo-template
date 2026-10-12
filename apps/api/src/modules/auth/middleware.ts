import { eq } from "drizzle-orm";
import type { Context, Next } from "hono";
import type { Database } from "@repo/db";
import { member } from "@repo/db/schema";
import type { AuthSession, AuthUser } from "./auth";

export type AuthVariables = {
  session: AuthSession | null;
  user: AuthUser | null;
  organizationId: string | null;
};
export type AuthProvider = {
  getSession: (headers: Headers) => Promise<{ session: AuthSession; user: AuthUser } | null>;
  handler: (request: Request) => Promise<Response>;
};

export function createSessionMiddleware(auth: AuthProvider, db: Pick<Database, "select">) {
  return async (c: Context<{ Variables: AuthVariables }>, next: Next) => {
    const session = await auth.getSession(c.req.raw.headers);
    c.set("session", session?.session ?? null);
    c.set("user", session?.user ?? null);
    c.set("organizationId", session ? await resolveOrganizationId(db, session) : null);
    await next();
  };
}

// Prefer the session's active organization; otherwise fall back to the user's
// first membership (every user owns at least one org from sign-up, F14).
async function resolveOrganizationId(
  db: Pick<Database, "select">,
  session: { session: AuthSession; user: AuthUser },
): Promise<string | null> {
  const active = (session.session as { activeOrganizationId?: string | null }).activeOrganizationId;
  if (active) return active;
  const rows = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, session.user.id))
    .limit(1);
  return rows[0]?.organizationId ?? null;
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
