import type { authClient } from "../../lib/api";

export type LoginInput = Parameters<typeof authClient.signIn.email>[0];
export type RegisterInput = Parameters<typeof authClient.signUp.email>[0];
