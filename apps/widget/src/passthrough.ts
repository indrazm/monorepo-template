import type { WidgetSettings } from "@repo/contracts/widget";

type AnalyticsWindow = Window & {
  gtag?: (...args: unknown[]) => void;
  dataLayer?: unknown[];
  fbq?: (...args: unknown[]) => void;
  mixpanel?: { track?: (name: string, props?: unknown) => void };
};

// Forwards a widget view/click to whatever analytics the host page already has
// (FR-NGS-06). Uses existing globals only; never loads anything. Fail-safe.
export function forwardAnalytics(
  settings: WidgetSettings,
  kind: "view" | "click",
  notificationId: string,
): void {
  const pass = settings.analyticsPassthrough;
  if (!pass) return;
  const w = window as AnalyticsWindow;
  const eventName = `tacto_notification_${kind}`;
  const props = { notification_id: notificationId };
  try {
    if (pass.gtag && typeof w.gtag === "function") w.gtag("event", eventName, props);
    if (pass.dataLayer && Array.isArray(w.dataLayer))
      w.dataLayer.push({ event: eventName, ...props });
    if (pass.fbq && typeof w.fbq === "function") w.fbq("trackCustom", eventName, props);
    if (pass.mixpanel && typeof w.mixpanel?.track === "function")
      w.mixpanel.track(eventName, props);
  } catch {
    /* fail-safe */
  }
}
