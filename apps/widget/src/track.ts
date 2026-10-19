import type { TrackEventInput } from "@repo/contracts/widget";
import { postBeacon } from "./net";
import { visitorId } from "./visitor";

// Fire-and-forget impression/click beacon (SRS FR-ANL-01). Never throws. The
// current page path rides along for the analytics "top pages" breakdown
// (FR-ANL-02); device/browser/country are derived server-side from the request.
export function track(apiBase: string, body: TrackEventInput): void {
  try {
    const payload = JSON.stringify({
      ...body,
      visitorId: visitorId(),
      url: body.url ?? location.pathname,
    });
    postBeacon(apiBase, "/widget/v1/track", payload);
  } catch {
    /* fail-safe */
  }
}
