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
  ]),
});
export type ApiErrorCode = z.output<typeof apiErrorSchema>["error"];

export function apiError<Code extends ApiErrorCode>(error: Code) {
  return { error };
}
