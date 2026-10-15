// Records one pageview per session for the plan's visitor quota (SRS
// FR-BIL-01). Fail-safe: never throws, never blocks the host page.
import { postBeacon } from "./net";
import { visitorId } from "./visitor";

const VISITED_KEY = "tacto_visited";

export function visit(apiBase: string, siteKey: string): void {
  try {
    if (window.sessionStorage.getItem(VISITED_KEY) === "1") return;
    window.sessionStorage.setItem(VISITED_KEY, "1");
    postBeacon(
      apiBase,
      "/widget/v1/visit",
      JSON.stringify({ site: siteKey, visitorId: visitorId() }),
    );
  } catch {
    /* fail-safe */
  }
}
