import { createApiClient } from "@repo/api-client";
import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { parseWebEnv } from "./config";

export const env = parseWebEnv(import.meta.env);
export const apiClient = createApiClient(env.VITE_API_URL);
export const authClient = createAuthClient({
  baseURL: env.VITE_API_URL,
  plugins: [organizationClient()],
});
