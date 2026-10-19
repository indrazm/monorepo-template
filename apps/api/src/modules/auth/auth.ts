import { randomUUID } from "node:crypto";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { admin, organization, twoFactor } from "better-auth/plugins";
import { count, eq } from "drizzle-orm";
import type { Database } from "@repo/db";
import {
  integration,
  member,
  organization as organizationTable,
  site,
  subscription,
} from "@repo/db/schema";
import type { createApiConfig } from "../../config";
import * as schema from "@repo/db/schema";
import {
  changeEmailEmailContent,
  invitationEmailContent,
  passwordResetEmailContent,
  verificationEmailContent,
} from "./email-templates";
import type { Mailer } from "./mailer";

export function createAuth(
  db: Database,
  config: ReturnType<typeof createApiConfig>["auth"],
  mailer: Mailer,
) {
  const appUrl = config.trustedOrigins[0] ?? config.url;
  // The dashboard is served from a different site than the API (Cloudflare
  // Worker vs tunnel/host), so session cookies must be SameSite=None to be
  // sent cross-site. Secure follows the API scheme: plain-http local dev
  // keeps working (browsers ignore SameSite=None without Secure and fall
  // back to Lax, which is fine same-site on localhost).
  const crossSiteSecure = config.url.startsWith("https://");
  const sessionCookieAttributes = {
    sameSite: "none" as const,
    secure: crossSiteSecure,
  };
  return betterAuth({
    appName: "Tacto",
    telemetry: { enabled: false },
    baseURL: config.url,
    advanced: {
      ipAddress: {
        ipAddressHeaders: ["x-forwarded-for"],
        ...(config.trustedProxies.length > 0 ? { trustedProxies: config.trustedProxies } : {}),
      },
      cookies: {
        session_token: { attributes: sessionCookieAttributes },
        session_data: { attributes: sessionCookieAttributes },
        dont_remember: { attributes: sessionCookieAttributes },
        // The two-factor challenge and trust-device cookies are sent on
        // cross-site requests from the dashboard, like the session cookies.
        two_factor: { attributes: sessionCookieAttributes },
        trust_device: { attributes: sessionCookieAttributes },
      },
    },
    database: drizzleAdapter(db, {
      provider: "pg",
      schema,
    }),
    // Self-serve account deletion (feedback T12, GDPR). Deleting cascades to the
    // user's sessions/accounts; domain data is scoped to the org, removed
    // separately when the org is deleted.
    user: {
      changeEmail: {
        enabled: true,
        // Verified accounts confirm the change from their current inbox, so a
        // hijacked session cannot silently move the login email.
        sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
          await mailer.send({
            to: user.email,
            ...changeEmailEmailContent({ name: user.name, newEmail, url, appUrl }),
          });
        },
      },
      deleteUser: {
        enabled: true,
        // A sole owner taking their account away must not leave an orphaned
        // workspace (sites, events, PII, subscription). Other memberships are
        // removed by the auth cascade.
        beforeDelete: async (user) => {
          const memberships = await db
            .select({ organizationId: member.organizationId, role: member.role })
            .from(member)
            .where(eq(member.userId, user.id));
          for (const membership of memberships) {
            const [row] = await db
              .select({ value: count() })
              .from(member)
              .where(eq(member.organizationId, membership.organizationId));
            if ((row?.value ?? 0) !== 1 || membership.role !== "owner") continue;
            const sites = await db
              .select({ id: site.id })
              .from(site)
              .where(eq(site.organizationId, membership.organizationId));
            for (const ownedSite of sites) {
              await db.delete(site).where(eq(site.id, ownedSite.id));
            }
            await db
              .delete(integration)
              .where(eq(integration.organizationId, membership.organizationId));
            await db
              .delete(subscription)
              .where(eq(subscription.organizationId, membership.organizationId));
            await db
              .delete(organizationTable)
              .where(eq(organizationTable.id, membership.organizationId));
          }
        },
      },
    },
    emailAndPassword: {
      enabled: true,
      // Activation gate (FR-AUTH-01): an email+password account cannot log in
      // until its email is verified. Sign-up therefore returns no session and
      // the user must open the verification link first.
      requireEmailVerification: true,
      // Password reset link lifetime (FR-AUTH-06).
      resetPasswordTokenExpiresIn: config.passwordResetTokenTtl,
      // A successful reset revokes every existing session so a stolen session
      // cannot survive the password change.
      revokeSessionsOnPasswordReset: true,
      // `url` is Better Auth's reset link; it points at the API, validates the
      // token and then redirects back to the dashboard's /reset-password page.
      sendResetPassword: async ({ user, url }) => {
        await mailer.send({
          to: user.email,
          ...passwordResetEmailContent({ name: user.name, url, appUrl }),
        });
      },
    },
    // Sign-up email verification (FR-AUTH-01). The link points at the API,
    // verifies the token and redirects back to the dashboard.
    emailVerification: {
      expiresIn: config.verificationTokenTtl,
      sendOnSignUp: true,
      // Opening the link both verifies the address and starts a session, so the
      // user lands on the dashboard already signed in.
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        // Force the callback to the dashboard success page. Older clients (or
        // a stale web build) can otherwise omit `verified=1`, which leaves the
        // user on the "open the activation link" fallback even after success.
        const verificationUrl = withCallbackUrl(url, `${appUrl}/verify-email?verified=1`);
        await mailer.send({
          to: user.email,
          ...verificationEmailContent({ name: user.name, url: verificationUrl, appUrl }),
        });
      },
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
      // TOTP two-factor authentication (feedback T12). Enrollment is opt-in; the
      // sign-in flow only challenges users who have enabled it.
      twoFactor({ issuer: "Tacto" }),
      admin({
        adminRoles: ["admin"],
        defaultRole: "user",
      }),
      organization({
        allowUserToCreateOrganization: true,
        // Invitations (FR-AUTH-05). The invitation link lands on the dashboard,
        // where the team page accepts the token.
        sendInvitationEmail: async (data) => {
          const link = `${appUrl}/accept-invitation/${data.id}`;
          await mailer.send({
            to: data.email,
            ...invitationEmailContent({
              organizationName: data.organization.name,
              inviterName: data.inviter.user.name,
              url: link,
              appUrl,
            }),
          });
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

// Replaces the callback URL on a Better Auth link (verification/reset) so the
// redirect target is owned by the dashboard, not by whatever the client sent.
function withCallbackUrl(value: string, callbackURL: string): string {
  const url = new URL(value);
  url.searchParams.set("callbackURL", callbackURL);
  return url.toString();
}
