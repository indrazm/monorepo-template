import { z } from "zod";

export const webEnvSchema = z.object({
  VITE_API_URL: z.url({ protocol: /^https?$/ }).default("http://localhost:8000"),
});
export function parseWebEnv(environment: Record<string, unknown>) {
  return webEnvSchema.parse(environment);
}
