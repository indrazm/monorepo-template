import type { WidgetPayloadResponse } from "@repo/contracts/widget";
import { isReturningVisitor, visitorId } from "./visitor";

// Fetches the notification payload for the current page. Fail-safe: any error
// resolves to null so the host site is never affected (SRS NFR-REL-02).
export async function loadPayload(
  apiBase: string,
  siteKey: string,
  url: string,
): Promise<WidgetPayloadResponse | null> {
  try {
    const lang = typeof navigator !== "undefined" ? navigator.language : "";
    const vid = visitorId() ?? "";
    // Visit context for targeting (FR-NED-07): campaign params, referrer and
    // whether this browser has been here before.
    const query = location.search.slice(0, 500);
    const referrer = (document.referrer || "").slice(0, 500);
    const segment = isReturningVisitor() ? "returning" : "new";
    const endpoint = `${apiBase}/widget/v1/payload?site=${encodeURIComponent(
      siteKey,
    )}&url=${encodeURIComponent(url)}&lang=${encodeURIComponent(lang)}&vid=${encodeURIComponent(
      vid,
    )}&q=${encodeURIComponent(query)}&ref=${encodeURIComponent(referrer)}&vs=${segment}`;
    const response = await fetch(endpoint, { credentials: "omit" });
    if (!response.ok) return null;
    return (await response.json()) as WidgetPayloadResponse;
  } catch {
    return null;
  }
}
