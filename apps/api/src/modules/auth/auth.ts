import { randomUUID } from "node:crypto";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { admin, organization } from "better-auth/plugins";
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
    plugins: [
      admin({
        adminRoles: ["admin"],
        defaultRole: "user",
      }),
      organization({
        allowUserToCreateOrganization: true,
      }),
    ],
    databaseHooks: {
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
