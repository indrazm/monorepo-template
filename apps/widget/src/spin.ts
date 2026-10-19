import type { SpinClaimResponse } from "@repo/contracts/widget";
import { tunnelHeaders } from "./net";
import { visitorId } from "./visitor";

// Asks the API to draw (or return the already-claimed) reward for this visitor.
// The coupon code never exists in the rendered payload, so it cannot be read
// without a server-side claim. Fail-safe: resolves to null.
export async function claimSpin(
  apiBase: string,
  siteKey: string,
  notificationId: string,
): Promise<SpinClaimResponse | null> {
  try {
    const vid = visitorId();
    if (!vid) return null;
    const response = await fetch(`${apiBase}/widget/v1/spin/claim`, {
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": "application/json", ...tunnelHeaders(apiBase) },
      body: JSON.stringify({ site: siteKey, notificationId, visitorId: vid }),
    });
    if (!response.ok) return null;
    return (await response.json()) as SpinClaimResponse;
  } catch {
    return null;
  }
}
