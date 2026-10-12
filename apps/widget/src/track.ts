import type { TrackEventInput } from "@repo/contracts/widget";

// Fire-and-forget impression/click beacon (SRS FR-ANL-01). Never throws.
export function track(apiBase: string, body: TrackEventInput): void {
  try {
    const url = `${apiBase}/widget/v1/track`;
    const payload = JSON.stringify(body);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
    } else {
      void fetch(url, { method: "POST", body: payload, keepalive: true, credentials: "omit" });
    }
  } catch {
    /* fail-safe */
  }
}
