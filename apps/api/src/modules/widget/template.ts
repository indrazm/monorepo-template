import type { NotificationMessage } from "@repo/contracts/notifications";

export type TemplateVars = {
  first_name?: string | null;
  city?: string | null;
  product?: string | null;
  count?: number | null;
  occurredAt?: Date | null;
};

const VARIABLE = /\{\{\s*(first_name|city|product|time_ago|count)\s*\}\}/g;

// Resolves a notification message template into display text. Only a first name
// and city are ever shown (GDPR data minimization, SRS FR-NED-01/02/04,
// NFR-PRIV-01). Empty variables use the configured fallback, else drop out.
export function renderMessage(message: NotificationMessage, vars: TemplateVars): string {
  const hideAfter = message.hideTimeAgoAfterDays;
  const resolved = message.template.replace(VARIABLE, (_match, key: string) => {
    const value = resolveVariable(key, vars, hideAfter);
    if (value && value.length > 0) return value;
    return message.fallbacks[key] ?? "";
  });
  // Collapse the whitespace left by any dropped variables.
  return resolved.replace(/\s{2,}/g, " ").trim();
}

function resolveVariable(
  key: string,
  vars: TemplateVars,
  hideTimeAgoAfterDays: number | undefined,
): string {
  switch (key) {
    case "first_name":
      return capitalize(firstNameOnly(vars.first_name));
    case "city":
      return capitalize((vars.city ?? "").trim());
    case "product":
      return (vars.product ?? "").trim();
    case "count":
      return vars.count == null ? "" : String(vars.count);
    case "time_ago":
      return timeAgo(vars.occurredAt ?? null, hideTimeAgoAfterDays);
    default:
      return "";
  }
}

function firstNameOnly(name: string | null | undefined): string {
  return (name ?? "").trim().split(/\s+/)[0] ?? "";
}

function capitalize(value: string): string {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// Human "x minutes ago"; collapses to "recently" past the configured horizon.
export function timeAgo(occurredAt: Date | null, hideAfterDays?: number): string {
  if (!occurredAt) return "";
  const diffMs = Date.now() - occurredAt.getTime();
  if (diffMs < 0) return "just now";
  const days = diffMs / 86_400_000;
  if (hideAfterDays !== undefined && days > hideAfterDays) return "recently";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const wholeDays = Math.floor(days);
  return `${wholeDays} day${wholeDays === 1 ? "" : "s"} ago`;
}
