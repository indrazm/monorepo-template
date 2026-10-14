import { optionalStringSchema, runtimeEnvSchema } from "@repo/config/runtime";
import { z } from "zod";
import { databaseUrlSchema } from "@repo/config/database";

const defaultBetterAuthSecret = "dev-change-me";
const originSchema = z.url({ protocol: /^https?$/ }).pipe(
  z.string().refine((value) => {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && url.origin === value;
  }, "Expected an http or https origin without a path."),
);
const originsSchema = z
  .string()
  .transform((value) => value.split(",").map((item) => item.trim()))
  .pipe(z.array(originSchema).min(1));

export const apiEnvSchema = z
  .object({
    NODE_ENV: runtimeEnvSchema,
    API_PORT: z.coerce.number().int().min(1).max(65535).default(8000),
    BETTER_AUTH_SECRET: optionalStringSchema.transform((value) => value ?? defaultBetterAuthSecret),
    BETTER_AUTH_URL: z.url({ protocol: /^https?$/ }).default("http://localhost:8000"),
    CLIENT_ORIGINS: originsSchema.default(["http://localhost:3000"]),
    DATABASE_URL: databaseUrlSchema,
    REDIS_URL: z.url({ protocol: /^rediss?$/ }).default("redis://localhost:16379"),
    GOOGLE_CLIENT_ID: optionalStringSchema,
    GOOGLE_CLIENT_SECRET: optionalStringSchema,
    STRIPE_SECRET_KEY: optionalStringSchema,
    STRIPE_WEBHOOK_SECRET: optionalStringSchema,
    // Review import (FR-ING-10) — configured per integration, these are the
    // platform-level API credentials.
    GOOGLE_PLACES_API_KEY: optionalStringSchema,
    FACEBOOK_PAGE_ACCESS_TOKEN: optionalStringSchema,
    YOUTUBE_API_KEY: optionalStringSchema,
    // Outbound email (invitations, password reset). Unset = links are logged.
    SMTP_HOST: optionalStringSchema,
    SMTP_PORT: optionalStringSchema,
    SMTP_USER: optionalStringSchema,
    SMTP_PASSWORD: optionalStringSchema,
    SMTP_FROM: optionalStringSchema,
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV !== "production") return;
    if (env.BETTER_AUTH_SECRET === defaultBetterAuthSecret) {
      context.addIssue({
        code: "custom",
        message: "BETTER_AUTH_SECRET must be changed in production.",
        path: ["BETTER_AUTH_SECRET"],
      });
    }
    if (env.BETTER_AUTH_SECRET.length < 32) {
      context.addIssue({
        code: "custom",
        message: "BETTER_AUTH_SECRET must be at least 32 characters in production.",
        path: ["BETTER_AUTH_SECRET"],
      });
    }
  });

export function parseApiEnv(environment: Record<string, string | undefined>) {
  return apiEnvSchema.parse(environment);
}
export function createApiConfig(env: ReturnType<typeof parseApiEnv>) {
  return {
    port: env.API_PORT,
    clientOrigins: env.CLIENT_ORIGINS,
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL,
    stripe: {
      secretKey: env.STRIPE_SECRET_KEY ?? null,
      webhookSecret: env.STRIPE_WEBHOOK_SECRET ?? null,
    },
    reviewImport: {
      googlePlacesApiKey: env.GOOGLE_PLACES_API_KEY ?? null,
      facebookPageAccessToken: env.FACEBOOK_PAGE_ACCESS_TOKEN ?? null,
      youtubeApiKey: env.YOUTUBE_API_KEY ?? null,
    },
    smtp: {
      host: env.SMTP_HOST ?? null,
      port: env.SMTP_PORT ?? null,
      user: env.SMTP_USER ?? null,
      password: env.SMTP_PASSWORD ?? null,
      from: env.SMTP_FROM ?? null,
    },
    auth: {
      secret: env.BETTER_AUTH_SECRET,
      trustedOrigins: env.CLIENT_ORIGINS,
      url: env.BETTER_AUTH_URL,
      google:
        env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
          ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
          : null,
    },
  };
}
