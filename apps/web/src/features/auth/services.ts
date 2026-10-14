import { fetchSessionUser } from "@repo/api-client";
import { apiClient, authClient } from "../../api";
import type { LoginInput, RegisterInput } from "./types";

export async function getCurrentUser() {
  return fetchSessionUser(apiClient);
}

export async function login(input: LoginInput) {
  const { error } = await authClient.signIn.email(input);

  if (error) {
    throw new Error(error.message ?? "Authentication failed.");
  }

  return getCurrentUser();
}

export async function register(input: RegisterInput) {
  const { error } = await authClient.signUp.email({
    email: input.email,
    name: input.name.trim(),
    password: input.password,
  });

  if (error) {
    throw new Error(error.message ?? "Registration failed.");
  }

  return getCurrentUser();
}

export async function logout() {
  const { error } = await authClient.signOut();

  if (error) {
    throw new Error(error.message ?? "Failed to log out.");
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
    throw new Error(error.message ?? "Could not start password reset.");
  }
}

export async function resetPassword(token: string, newPassword: string) {
  const { error } = await authClient.resetPassword({ token, newPassword });
  if (error) {
    throw new Error(error.message ?? "Could not reset password.");
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
    throw new Error(error.message ?? "Google sign-in failed.");
  }
}
