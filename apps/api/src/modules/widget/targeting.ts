import type { NotificationDisplay } from "@repo/contracts/notifications";
import { matchUrl } from "./url-match";

// ---------------------------------------------------------------------------
// Display targeting (SRS FR-NED-07). Every rule the editor offers is executed
// here: URL, country, UTM parameters, referrer and visitor segment. A rule that
// is not set never filters anything out.
// ---------------------------------------------------------------------------

export type VisitContext = {
  url: string;
  country?: string | null;
  // Query parameters of the page the visitor landed on (utm_* and friends).
  params?: Record<string, string>;
  referrer?: string | null;
  // "new" on a visitor's first-ever pageview, "returning" afterwards.
  visitor?: "new" | "returning" | null;
};

export function matchesTargeting(display: NotificationDisplay, context: VisitContext): boolean {
  if (!matchUrl(display.url, context.url)) return false;
  if (!countryAllowed(display.countries, context.country)) return false;
  if (!utmMatches(display.utm, context.params)) return false;
  if (!referrerMatches(display.referrer, context.referrer)) return false;
  if (!visitorMatches(display.visitor, context.visitor)) return false;
  return true;
}

// Country targeting (FR-NGS-07). No list → show everywhere; list set but geo
// unknown → allow (fail-open, we cannot filter reliably).
export function countryAllowed(
  countries: string[] | undefined,
  country: string | null | undefined,
): boolean {
  if (!countries || countries.length === 0) return true;
  if (!country) return true;
  const code = country.trim().toUpperCase();
  if (code === "XX" || code === "T1") return true; // Cloudflare unknown / Tor
  return countries.some((entry) => entry.toUpperCase() === code);
}

// Every configured parameter must be present with that value. Comparison is
// case-insensitive on the value, since campaign tags are typed by hand.
function utmMatches(
  utm: Record<string, string> | undefined,
  params: Record<string, string> | undefined,
): boolean {
  const rules = Object.entries(utm ?? {}).filter(([, value]) => value.trim().length > 0);
  if (rules.length === 0) return true;
  if (!params) return false;
  return rules.every(([name, expected]) => {
    const actual = params[name] ?? params[name.toLowerCase()];
    return typeof actual === "string" && actual.toLowerCase() === expected.trim().toLowerCase();
  });
}

function referrerMatches(
  rule: { mode: "any" | "contains" | "regex"; value?: string } | undefined,
  referrer: string | null | undefined,
): boolean {
  if (!rule || rule.mode === "any") return true;
  const value = rule.value?.trim();
  if (!value) return true;
  // A rule is set but the visitor arrived without a referrer → it cannot match.
  if (!referrer) return false;
  const target = referrer.slice(0, 2000);
  if (rule.mode === "contains") return target.toLowerCase().includes(value.toLowerCase());
  // Same ReDoS guard as URL regex targeting: reject over-long patterns.
  if (value.length > 300) return false;
  try {
    return new RegExp(value).test(target);
  } catch {
    return false;
  }
}

function visitorMatches(
  segment: "all" | "new" | "returning" | undefined,
  visitor: "new" | "returning" | null | undefined,
): boolean {
  if (!segment || segment === "all") return true;
  // Unknown visitor state (pixel too old to report it) → fail open.
  if (!visitor) return true;
  return segment === visitor;
}

// Parses a raw query string ("?utm_source=x&utm_medium=y") into a bounded map.
// Caps the number of params so a crafted URL cannot blow up the cache key.
export function parseParams(query: string | null | undefined): Record<string, string> {
  if (!query) return {};
  const out: Record<string, string> = {};
  try {
    const search = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
    let count = 0;
    for (const [name, value] of search.entries()) {
      if (count >= 20) break;
      out[name.toLowerCase()] = value.slice(0, 120);
      count += 1;
    }
  } catch {
    return {};
  }
  return out;
}

// The part of the visit context that can change which notifications are served.
// Used in the payload cache key, kept low-cardinality: only utm-ish params and
// the referrer host matter, not the full referring URL.
export function targetingCacheKey(context: VisitContext): string {
  const params = Object.entries(context.params ?? {})
    .filter(([name]) => name.startsWith("utm_") || name === "gclid" || name === "fbclid")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `${name}=${value}`)
    .join("&");
  let referrerHost = "";
  if (context.referrer) {
    try {
      referrerHost = new URL(context.referrer).hostname.toLowerCase();
    } catch {
      referrerHost = "invalid";
    }
  }
  return `${params}|${referrerHost}|${context.visitor ?? ""}`;
}
