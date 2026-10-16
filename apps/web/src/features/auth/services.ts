import { fetchSessionUser } from "@repo/api-client";
import { apiClient, authClient } from "../../api";
import type { LoginInput, RegisterInput } from "./types";

// Better Auth client errors carry a stable `code` (e.g. EMAIL_NOT_VERIFIED)
// that the UI uses to choose a specific recovery action. Keep it on the Error.
export class AuthError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}

function toAuthError(error: { message?: string; code?: string }, fallback: string) {
  return new AuthError(error.message ?? fallback, error.code);
}

// Where the verification link lands back in the dashboard. `verified=1` marks
// the success path; Better Auth appends `&error=...` when the token is invalid
// or expired, which the page treats as a failure.
export function verificationCallbackUrl() {
  return `${window.location.origin}/verify-email?verified=1`;
}

export async function getCurrentUser() {
  return fetchSessionUser(apiClient);
}

export async function login(input: LoginInput) {
  const { error } = await authClient.signIn.email(input);

  if (error) {
    throw toAuthError(error, "Authentication failed.");
  }

  return getCurrentUser();
}

export async function register(input: RegisterInput) {
  const email = input.email.trim();
  const { error } = await authClient.signUp.email({
    email,
    name: input.name.trim(),
    password: input.password,
    // Sign-up returns no session while the address is unverified; the emailed
    // link redirects back to /verify-email and signs the user in.
    callbackURL: verificationCallbackUrl(),
  });

  if (error) {
    throw toAuthError(error, "Registration failed.");
  }

  return { email };
}

// Resends the activation email for an account that exists but is unverified.
// Better Auth responds generically so this never reveals whether the address is
// registered (anti-enumeration).
export async function sendVerificationEmail(email: string) {
  const { error } = await authClient.sendVerificationEmail({
    email: email.trim(),
    callbackURL: verificationCallbackUrl(),
  });

  if (error) {
    throw toAuthError(error, "Could not send the verification email.");
  }
}

export async function logout() {
  const { error } = await authClient.signOut();

  if (error) {
    throw toAuthError(error, "Failed to log out.");
  }
}

// Password reset (FR-AUTH-06). Better Auth emails a link to `${redirectTo}
// ?token=...`; the reset page submits the new password with that token.
export async function requestPasswordReset(email: string) {
  const { error } = await authClient.requestPasswordReset({
    email,
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) {
    throw toAuthError(error, "Could not start password reset.");
  }
}

export async function resetPassword(token: string, newPassword: string) {
  const { error } = await authClient.resetPassword({ token, newPassword });
  if (error) {
    throw toAuthError(error, "Could not reset password.");
  }
}

// Starts the Google OAuth flow; Better Auth redirects to Google and back to
// callbackURL on success (FR-AUTH-04).
export async function loginWithGoogle() {
  const { error } = await authClient.signIn.social({
    provider: "google",
    callbackURL: `${window.location.origin}/`,
  });
  if (error) {
    throw toAuthError(error, "Google sign-in failed.");
  }
}
