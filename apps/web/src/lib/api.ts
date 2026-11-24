import { createApiClient } from "@repo/api-client";
import { createAuthClient } from "better-auth/react";
import { parseWebEnv } from "./config";

const env = parseWebEnv(import.meta.env);
export const apiClient = createApiClient(env.VITE_API_URL);
export const authClient = createAuthClient({ baseURL: env.VITE_API_URL });
