import { randomUUID } from "node:crypto";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { admin, organization, twoFactor } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import type { Database } from "@repo/db";
import { member, organization as organizationTable, subscription } from "@repo/db/schema";
import type { createApiConfig } from "../../config";
import * as schema from "@repo/db/schema";
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
      cookies: {
        session_token: { attributes: sessionCookieAttributes },
        session_data: { attributes: sessionCookieAttributes },
        dont_remember: { attributes: sessionCookieAttributes },
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
      deleteUser: { enabled: true },
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
          subject: "Reset your Tacto password",
          text: [
            `Hi ${user.name},`,
            "",
            "We received a request to reset your Tacto password. Open the link below to choose a new one:",
            url,
            "",
            "This link expires in 1 hour. If you did not request this, you can ignore this email.",
          ].join("\n"),
          html: [
            `<p>Hi ${escapeHtml(user.name)},</p>`,
            "<p>We received a request to reset your Tacto password. Click the button below to choose a new one.</p>",
            `<p><a href="${url}">Reset password</a></p>`,
            "<p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>",
          ].join(""),
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
        await mailer.send({
          to: user.email,
          subject: "Activate your Tacto account",
          text: [
            `Welcome to Tacto, ${user.name}.`,
            "",
            "Confirm your email address to activate your account:",
            url,
            "",
            "This link expires in 24 hours. If you did not create an account, you can ignore this email.",
          ].join("\n"),
          html: [
            `<p>Welcome to Tacto, ${escapeHtml(user.name)}.</p>`,
            "<p>Confirm your email address to activate your account.</p>",
            `<p><a href="${url}">Activate my account</a></p>`,
            "<p>This link expires in 24 hours. If you did not create an account, you can ignore this email.</p>",
          ].join(""),
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
        // Invitations (FR-AUTH-05). Without an email provider configured we log
        // the accept link so an admin can share it; wire SMTP to send for real.
        sendInvitationEmail: async (data) => {
          const link = `${appUrl}/accept-invitation/${data.id}`;
          await mailer.send({
            to: data.email,
            subject: "You've been invited to a Tacto organization",
            text: `Accept your invitation: ${link}`,
            html: `<p>You've been invited to join a Tacto organization.</p><p><a href="${link}">Accept invitation</a></p>`,
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

// User names are interpolated into HTML emails; escape them so a crafted name
// cannot inject markup.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
