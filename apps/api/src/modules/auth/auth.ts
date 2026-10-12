import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import type { Database } from "@repo/db";
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
    ],
    secret: config.secret,
    trustedOrigins: config.trustedOrigins,
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type AuthSession = Auth["$Infer"]["Session"]["session"];
export type AuthUser = Auth["$Infer"]["Session"]["user"];
