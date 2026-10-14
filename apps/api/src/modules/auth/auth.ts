import { randomUUID } from "node:crypto";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { admin, organization } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import type { Database } from "@repo/db";
import { member, organization as organizationTable, subscription } from "@repo/db/schema";
import type { createApiConfig } from "../../config";
import * as schema from "@repo/db/schema";

export function createAuth(db: Database, config: ReturnType<typeof createApiConfig>["auth"]) {
  return betterAuth({
    appName: "Tacto",
    telemetry: { enabled: false },
    baseURL: config.url,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema,
    }),
    emailAndPassword: {
      enabled: true,
    },
    // Google OAuth is enabled only when credentials are configured (FR-AUTH-04).
    // Better Auth handles the full flow at /api/auth/callback/google.
    ...(config.google
      ? {
          socialProviders: {
            google: {
              clientId: config.google.clientId,
              clientSecret: config.google.clientSecret,
            },
          },
        }
      : {}),
    plugins: [
      admin({
        adminRoles: ["admin"],
        defaultRole: "user",
      }),
      organization({
        allowUserToCreateOrganization: true,
        // Invitations (FR-AUTH-05). Without an email provider configured we log
        // the accept link so an admin can share it; wire SMTP to send for real.
        sendInvitationEmail: async (data) => {
          const appUrl = config.trustedOrigins[0] ?? "";
          const link = `${appUrl}/accept-invitation/${data.id}`;
          console.info("Organization invitation", { email: data.email, link });
        },
      }),
    ],
    databaseHooks: {
      session: {
        create: {
          // Make the user's first organization the active one so the org-plugin
          // endpoints (members, invitations) resolve a tenant (F16).
          before: async (session) => {
            const [row] = await db
              .select({ organizationId: member.organizationId })
              .from(member)
              .where(eq(member.userId, session.userId))
              .limit(1);
            return { data: { ...session, activeOrganizationId: row?.organizationId ?? null } };
          },
        },
      },
      user: {
        create: {
          // Every new user gets a default organization they own, plus a free
          // subscription (SRS FR-AUTH-03, FR-BIL-01). The dashboard always has
          // a tenant to scope data to.
          after: async (createdUser) => {
            const organizationId = randomUUID();
            const displayName = createdUser.name?.trim() || createdUser.email.split("@")[0];
            await db.insert(organizationTable).values({
              id: organizationId,
              name: `${displayName}'s workspace`,
              slug: `org-${createdUser.id}`,
              createdAt: new Date(),
            });
            await db.insert(member).values({
              id: randomUUID(),
              organizationId,
              userId: createdUser.id,
              role: "owner",
              createdAt: new Date(),
            });
            await db.insert(subscription).values({
              id: randomUUID(),
              organizationId,
              plan: "free",
            });
          },
        },
      },
    },
    secret: config.secret,
    trustedOrigins: config.trustedOrigins,
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type AuthSession = Auth["$Infer"]["Session"]["session"];
export type AuthUser = Auth["$Infer"]["Session"]["user"];
