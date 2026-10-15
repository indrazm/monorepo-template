import type { TrackEventInput } from "@repo/contracts/widget";
import { postBeacon } from "./net";
import { visitorId } from "./visitor";

// Fire-and-forget impression/click beacon (SRS FR-ANL-01). Never throws.
export function track(apiBase: string, body: TrackEventInput): void {
  try {
    const payload = JSON.stringify({ ...body, visitorId: visitorId() });
    postBeacon(apiBase, "/widget/v1/track", payload);
  } catch {
    /* fail-safe */
  }
}
