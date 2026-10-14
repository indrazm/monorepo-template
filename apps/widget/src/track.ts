import type { TrackEventInput } from "@repo/contracts/widget";

const VISITOR_KEY = "tacto_vid";

// Stable per-browser id so distinct live visitors can be counted (F33). Fail-safe.
function visitorId(): string | undefined {
  try {
    const existing = window.localStorage.getItem(VISITOR_KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(VISITOR_KEY, id);
    return id;
  } catch {
    return undefined;
  }
}

// Fire-and-forget impression/click beacon (SRS FR-ANL-01). Never throws.
export function track(apiBase: string, body: TrackEventInput): void {
  try {
    const url = `${apiBase}/widget/v1/track`;
    const payload = JSON.stringify({ ...body, visitorId: visitorId() });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
    } else {
      void fetch(url, { method: "POST", body: payload, keepalive: true, credentials: "omit" });
    }
  } catch {
    /* fail-safe */
  }
}
