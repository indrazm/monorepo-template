import { createApiClient } from "@repo/api-client";
import { organizationClient, twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { parseWebEnv } from "./config";

export const env = parseWebEnv(import.meta.env);

// Guard against shipping the localhost pixel URL in a production build: the
// install snippet we show customers is built from VITE_WIDGET_CDN_URL, so a
// localhost value here would tell customers to load the pixel from their own
// machine. Set VITE_WIDGET_CDN_URL to the public pixel host (e.g.
// https://app.tacto.software) before deploying.
if (
  import.meta.env.PROD &&
  /(^|\/\/)(localhost|127\.0\.0\.1)(:|\/|$)/.test(env.VITE_WIDGET_CDN_URL)
) {
  console.error(
    `[tacto] VITE_WIDGET_CDN_URL is "${env.VITE_WIDGET_CDN_URL}" in a production build — the customer install snippet will point at localhost.`,
  );
}

export const apiClient = createApiClient(env.VITE_API_URL);
export const authClient = createAuthClient({
  baseURL: env.VITE_API_URL,
  plugins: [organizationClient(), twoFactorClient()],
});

// Error carrying the API's structured detail: a human message plus optional
// per-field validation messages (zod `fieldErrors`). Forms read `.fields` to
// show the error under the exact input instead of only a generic toast.
export class ApiError extends Error {
  readonly code?: string;
  readonly fields?: Record<string, string[]>;
  constructor(message: string, code?: string, fields?: Record<string, string[]>) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.fields = fields;
  }
}

const ERROR_MESSAGES: Record<string, string> = {
  unauthorized: "Please sign in and try again.",
  forbidden: "You do not have permission to do that.",
  validation_error: "Please check the highlighted fields.",
  plan_limit_reached: "You've reached your plan's limit — upgrade to add more.",
  rate_limited: "Too many requests — please wait a moment and try again.",
  conflict: "That change conflicts with existing data.",
  integration_unconfigured: "This integration isn't configured yet.",
};

// Build an ApiError from a failed Response, reading the shared error envelope
// ({ error, message?, fields? }) when present and falling back to `fallback`.
export async function apiErrorFrom(response: Response, fallback: string): Promise<ApiError> {
  try {
    const body = (await response.json()) as {
      error?: string;
      message?: string;
      fields?: Record<string, string[]>;
    };
    const message = body.message ?? (body.error && ERROR_MESSAGES[body.error]) ?? fallback;
    return new ApiError(message, body.error, body.fields);
  } catch {
    return new ApiError(fallback);
  }
}
