import type { Context, Next } from "hono";
import type { AuthSession, AuthUser } from "./auth";

export type AuthVariables = { session: AuthSession | null; user: AuthUser | null };
export type AuthProvider = {
  getSession: (headers: Headers) => Promise<{ session: AuthSession; user: AuthUser } | null>;
  handler: (request: Request) => Promise<Response>;
};
export type SessionMiddleware = ReturnType<typeof createSessionMiddleware>;

export function createSessionMiddleware(auth: AuthProvider) {
  return async (c: Context<{ Variables: AuthVariables }>, next: Next) => {
    const session = await auth.getSession(c.req.raw.headers);
    c.set("session", session?.session ?? null);
    c.set("user", session?.user ?? null);
    await next();
  };
}

export function getAdminUser(c: Context<{ Variables: AuthVariables }>) {
  const user = c.get("user");
  return user?.role?.split(",").includes("admin") ? user : null;
}
