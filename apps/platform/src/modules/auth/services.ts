import { authApiPaths } from "./schema";
import type { AuthResponse, AuthUser, LoginInput, RegisterInput } from "./types";

const apiBaseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export async function getCurrentUser() {
  const response = await fetch(`${apiBaseUrl}${authApiPaths.me}`, {
    credentials: "include",
  });

  if (response.status === 401) {
    throw new UnauthorizedError();
  }

  if (!response.ok) {
    throw new Error("Failed to load current user.");
  }

  const data = (await response.json()) as { user: AuthUser };

  return data.user;
}

export async function login(input: LoginInput) {
  return authRequest(authApiPaths.login, input);
}

export async function register(input: RegisterInput) {
  return authRequest(authApiPaths.register, input);
}

export async function logout() {
  const response = await fetch(`${apiBaseUrl}${authApiPaths.logout}`, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to log out.");
  }
}

async function authRequest(path: string, input: LoginInput | RegisterInput) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const data = (await response.json().catch(() => null)) as AuthResponse | null;

  if (!response.ok || !data?.user) {
    throw new Error(data?.error ?? "Authentication failed.");
  }

  return data.user;
}
