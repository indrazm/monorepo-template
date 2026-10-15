// Records one pageview per session for the plan's visitor quota (SRS
// FR-BIL-01). Fail-safe: never throws, never blocks the host page.
import { visitorId } from "./visitor";

const VISITED_KEY = "tacto_visited";

export function visit(apiBase: string, siteKey: string): void {
  try {
    if (window.sessionStorage.getItem(VISITED_KEY) === "1") return;
    window.sessionStorage.setItem(VISITED_KEY, "1");
    const url = `${apiBase}/widget/v1/visit`;
    const payload = JSON.stringify({ site: siteKey, visitorId: visitorId() });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
    } else {
      void fetch(url, { method: "POST", body: payload, keepalive: true, credentials: "omit" });
    }
  } catch {
    /* fail-safe */
  }
}
