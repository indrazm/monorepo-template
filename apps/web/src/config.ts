import { z } from "zod";

export const webEnvSchema = z.object({
  VITE_API_URL: z.url({ protocol: /^https?$/ }).default("http://localhost:8000"),
  VITE_WIDGET_CDN_URL: z.url({ protocol: /^https?$/ }).default("http://localhost:8080"),
  // Public, internet-reachable API URL shown to users in copyable webhook/ingest
  // snippets (in development, an ngrok/Cloudflare tunnel that forwards to the
  // API). Falls back to VITE_API_URL when unset.
  VITE_PUBLIC_API_URL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.url({ protocol: /^https?$/ }).optional(),
  ),
  // In-app support (feedback T16). All optional: the help center always works;
  // these enable live chat, a "book a call" link and video guides when set.
  VITE_CRISP_WEBSITE_ID: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().optional(),
  ),
  VITE_SUPPORT_CALL_URL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.url({ protocol: /^https?$/ }).optional(),
  ),
  VITE_SUPPORT_VIDEO_URL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.url({ protocol: /^https?$/ }).optional(),
  ),
});
export function parseWebEnv(environment: Record<string, unknown>) {
  const parsed = webEnvSchema.parse(environment);
  return {
    ...parsed,
    // What to display for inbound webhooks / ingest endpoints (must be reachable
    // by third-party providers, so it is the public URL when configured).
    publicApiUrl: parsed.VITE_PUBLIC_API_URL ?? parsed.VITE_API_URL,
  };
}
