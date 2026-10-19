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
// Accepts "https://host", "http://host" or a bare "host", and always yields an
// origin without a trailing slash. Tunnel URLs are usually pasted bare.
const publicUrlSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string" || value.trim() === "") return undefined;
    const raw = value.trim().replace(/\/+$/, "");
    return /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
  },
  z.url({ protocol: /^https?$/ }).optional(),
);
const originsSchema = z
  .string()
  .transform((value) => value.split(",").map((item) => item.trim()))
  .pipe(z.array(originSchema).min(1));
// A positive integer of seconds, or the fallback when unset/blank. Used for the
// email-verification and password-reset token lifetimes.
const optionalSecondsSchema = (fallback: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.coerce.number().int().positive().default(fallback),
  );

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
    // Activation/reset token lifetimes in seconds. Verification defaults to a
    // full day so users do not have to race the clock; password reset stays
    // strict at one hour.
    EMAIL_VERIFICATION_EXPIRES_IN: optionalSecondsSchema(60 * 60 * 24),
    PASSWORD_RESET_EXPIRES_IN: optionalSecondsSchema(60 * 60),
    STRIPE_SECRET_KEY: optionalStringSchema,
    STRIPE_WEBHOOK_SECRET: optionalStringSchema,
    // Stripe Price IDs from the Dashboard — monthly and (optional) annual, one
    // per paid plan. Annual lets the dashboard offer a cheaper yearly option.
    STRIPE_PRICE_STARTER: optionalStringSchema,
    STRIPE_PRICE_GROWTH: optionalStringSchema,
    STRIPE_PRICE_AGENCY: optionalStringSchema,
    STRIPE_PRICE_STARTER_ANNUAL: optionalStringSchema,
    STRIPE_PRICE_GROWTH_ANNUAL: optionalStringSchema,
    STRIPE_PRICE_AGENCY_ANNUAL: optionalStringSchema,
    // Free-trial length (days) applied at checkout (feedback T11). Blank = none.
    STRIPE_TRIAL_DAYS: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.coerce.number().int().min(0).max(365).default(0),
    ),
    // Outbound email (invitations, password reset). Unset = links are logged.
    SMTP_HOST: optionalStringSchema,
    SMTP_PORT: optionalStringSchema,
    SMTP_USER: optionalStringSchema,
    SMTP_PASSWORD: optionalStringSchema,
    SMTP_FROM: optionalStringSchema,
    // Integration connectors. Per-organization provider credentials live in
    // the database (encrypted); these are the Tacto-level app credentials.
    HUBSPOT_CLIENT_ID: optionalStringSchema,
    HUBSPOT_CLIENT_SECRET: optionalStringSchema,
    SHOPIFY_API_KEY: optionalStringSchema,
    SHOPIFY_API_SECRET: optionalStringSchema,
    // Encrypts integration credentials at rest (AES-256-GCM). Falls back to
    // BETTER_AUTH_SECRET so development needs no extra setup.
    CREDENTIALS_SECRET: optionalStringSchema,
    // Review import + social/YouTube stat refresh (feedback T6/T7). Optional:
    // without them the dashboard falls back to manual/CSV entry.
    GOOGLE_PLACES_API_KEY: optionalStringSchema,
    FACEBOOK_PAGE_TOKEN: optionalStringSchema,
    YOUTUBE_API_KEY: optionalStringSchema,
    // Public, internet-reachable base URL of this API. Used to build the
    // webhook URLs Tacto registers with providers. Defaults to BETTER_AUTH_URL.
    // A bare host (e.g. an ngrok domain) is accepted and assumed to be https.
    PUBLIC_API_URL: publicUrlSchema,
    // Optional keyed static-map provider for the notification media fallback
    // (FR-NED-03). Unset = no map fallback (we do not call an unkeyed service).
    STATIC_MAP_URL_TEMPLATE: optionalStringSchema,
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
  const env = apiEnvSchema.parse(environment);
  if (env.NODE_ENV !== "production" && env.BETTER_AUTH_SECRET === defaultBetterAuthSecret) {
    console.warn(
      "[tacto] BETTER_AUTH_SECRET is unset: using the insecure development default. " +
        "Set a unique value in .env so sessions/cookies are actually signed.",
    );
  }
  return env;
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
      // Price IDs configured in the Stripe Dashboard (recommended over inline
      // amounts so Checkout matches your products). Monthly + optional annual.
      prices: {
        starter: {
          month: env.STRIPE_PRICE_STARTER ?? null,
          year: env.STRIPE_PRICE_STARTER_ANNUAL ?? null,
        },
        growth: {
          month: env.STRIPE_PRICE_GROWTH ?? null,
          year: env.STRIPE_PRICE_GROWTH_ANNUAL ?? null,
        },
        agency: {
          month: env.STRIPE_PRICE_AGENCY ?? null,
          year: env.STRIPE_PRICE_AGENCY_ANNUAL ?? null,
        },
      },
      // Free-trial days applied to Checkout subscriptions (0 = none).
      trialDays: env.STRIPE_TRIAL_DAYS,
    },
    smtp: {
      host: env.SMTP_HOST ?? null,
      port: env.SMTP_PORT ?? null,
      user: env.SMTP_USER ?? null,
      password: env.SMTP_PASSWORD ?? null,
      from: env.SMTP_FROM ?? null,
    },
    publicApiUrl: env.PUBLIC_API_URL ?? env.BETTER_AUTH_URL,
    credentialsSecret: env.CREDENTIALS_SECRET ?? env.BETTER_AUTH_SECRET,
    media: {
      // e.g. "https://maps.example.com/staticmap?center={lat},{lng}&key=..."
      staticMapTemplate: env.STATIC_MAP_URL_TEMPLATE ?? null,
    },
    // Review import + stat refresh providers (feedback T6/T7). Null = feature
    // falls back to manual/CSV entry in the dashboard.
    reviews: {
      googlePlacesApiKey: env.GOOGLE_PLACES_API_KEY ?? null,
      facebookPageToken: env.FACEBOOK_PAGE_TOKEN ?? null,
    },
    social: {
      youtubeApiKey: env.YOUTUBE_API_KEY ?? null,
    },
    integrations: {
      hubspot:
        env.HUBSPOT_CLIENT_ID && env.HUBSPOT_CLIENT_SECRET
          ? { clientId: env.HUBSPOT_CLIENT_ID, clientSecret: env.HUBSPOT_CLIENT_SECRET }
          : null,
      shopify:
        env.SHOPIFY_API_KEY && env.SHOPIFY_API_SECRET
          ? { apiKey: env.SHOPIFY_API_KEY, apiSecret: env.SHOPIFY_API_SECRET }
          : null,
    },
    auth: {
      secret: env.BETTER_AUTH_SECRET,
      trustedOrigins: env.CLIENT_ORIGINS,
      url: env.BETTER_AUTH_URL,
      // Token lifetimes for the email-verification and password-reset links.
      verificationTokenTtl: env.EMAIL_VERIFICATION_EXPIRES_IN,
      passwordResetTokenTtl: env.PASSWORD_RESET_EXPIRES_IN,
      google:
        env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
          ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
          : null,
    },
  };
}
