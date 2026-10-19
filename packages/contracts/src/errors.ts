import { z } from "zod";

export const apiErrorSchema = z.object({
  error: z.enum([
    "unauthorized",
    "forbidden",
    "invalid_cursor",
    "validation_error",
    "user_not_found",
    "site_not_found",
    "notification_not_found",
    "conflict",
    "plan_limit_reached",
    "rate_limited",
    "integration_unconfigured",
    "integration_not_found",
  ]),
  // Optional human-readable detail and per-field validation messages. The
  // latter mirrors zod's `flatten().fieldErrors`, so the dashboard can render
  // an error under the exact input that caused it instead of a generic toast.
  message: z.string().optional(),
  fields: z.record(z.string(), z.array(z.string())).optional(),
});
export type ApiErrorCode = z.output<typeof apiErrorSchema>["error"];
export type ApiErrorBody = z.output<typeof apiErrorSchema>;

export function apiError<Code extends ApiErrorCode>(
  error: Code,
  detail?: { message?: string; fields?: Record<string, string[]> },
): ApiErrorBody {
  return {
    error,
    ...(detail?.message ? { message: detail.message } : {}),
    ...(detail?.fields && Object.keys(detail.fields).length ? { fields: detail.fields } : {}),
  };
}
