import type { WidgetPayloadResponse } from "@repo/contracts/widget";

// Fetches the notification payload for the current page. Fail-safe: any error
// resolves to null so the host site is never affected (SRS NFR-REL-02).
export async function loadPayload(
  apiBase: string,
  siteKey: string,
  url: string,
): Promise<WidgetPayloadResponse | null> {
  try {
    const lang = typeof navigator !== "undefined" ? navigator.language : "";
    const endpoint = `${apiBase}/widget/v1/payload?site=${encodeURIComponent(
      siteKey,
    )}&url=${encodeURIComponent(url)}&lang=${encodeURIComponent(lang)}`;
    const response = await fetch(endpoint, { credentials: "omit" });
    if (!response.ok) return null;
    return (await response.json()) as WidgetPayloadResponse;
  } catch {
    return null;
  }
}
