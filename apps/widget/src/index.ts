import { attachCapture } from "./capture";
import { grantConsent, hasConsent, revokeConsent } from "./consent";
import { loadPayload } from "./loader";
import { forwardAnalytics } from "./passthrough";
import { startScheduler } from "./scheduler";
import { createSandbox, forwardCustom } from "./sandbox";
import { createShadowHost } from "./shadow";
import { track } from "./track";
import { visit } from "./visit";
import type { WidgetPayloadResponse } from "@repo/contracts/widget";

// Captured at synchronous eval time (document.currentScript is null later).
const currentScript =
  (document.currentScript as HTMLScriptElement | null) ??
  document.querySelector<HTMLScriptElement>("script[data-site]");

let started = false;

// Boots rendering + tracking once. Under consent mode this runs only after the
// visitor (or their CMP) grants consent (SRS FR-NGS-05).
function start(payload: WidgetPayloadResponse, apiBase: string, siteKey: string): void {
  if (started) return;
  started = true;

  // One pageview per session feeds the traffic quota (FR-BIL-01).
  visit(apiBase, siteKey);

  // Auto-capture is independent of having notifications to show.
  attachCapture(apiBase, siteKey);

  // Over the monthly visitor quota the API serves no notifications (FR-BIL-01).
  // The host page is left untouched on purpose — a visitor should never see an
  // upgrade prompt for someone else's plan — but the owner gets a clear console
  // notice when they look at their own site.
  if (payload.settings.overQuota) {
    console.warn(
      `[tacto] Monthly visitor quota reached — notifications are paused.${
        payload.settings.upgradeUrl ? ` Upgrade: ${payload.settings.upgradeUrl}` : ""
      }`,
    );
    return;
  }

  if (payload.notifications.length === 0) return;

  const position = payload.notifications[0]?.style.position ?? "bottom-left";
  const host = createShadowHost(position);

  // Per-domain custom CSS, scoped to the widget's shadow root (FR-NGS-04).
  if (payload.settings.customCss) {
    const custom = document.createElement("style");
    custom.textContent = payload.settings.customCss;
    host.root.appendChild(custom);
  }
  // Custom JS, isolated in a cross-origin sandbox iframe (FR-NGS-04). It only
  // observes widget events and may send one custom analytics event back.
  const sandbox = payload.settings.customJs
    ? createSandbox(payload.settings.customJs, {
        onTrack: (name) => forwardCustom(payload.settings.analyticsPassthrough, name),
      })
    : null;
  const typeOf = (refId: string) =>
    payload.notifications.find((item) => item.id === refId)?.type ?? "";

  startScheduler({
    host,
    siteKey,
    notifications: payload.notifications,
    settings: payload.settings,
    onView: (refId, variantId) => {
      track(apiBase, { site: siteKey, refId, kind: "view", variantId });
      forwardAnalytics(payload.settings, "view", refId);
      sandbox?.emit({ event: "view", id: refId, type: typeOf(refId) });
    },
    onClick: (refId, variantId) => {
      track(apiBase, { site: siteKey, refId, kind: "click", variantId });
      forwardAnalytics(payload.settings, "click", refId);
      sandbox?.emit({ event: "click", id: refId, type: typeOf(refId) });
    },
    onClaim: (refId, variantId) => {
      // A spin reward was won and handed to the visitor (F69): record the claim
      // as a first-class outcome so it shows up in analytics and goals.
      track(apiBase, { site: siteKey, refId, kind: "claim", variantId });
      forwardAnalytics(payload.settings, "claim", refId);
      sandbox?.emit({ event: "click", id: refId, type: typeOf(refId) });
    },
  });
}

// Entry for the Tacto pixel. Reads config from its own <script> tag and boots
// the widget. Everything is wrapped so a failure never breaks the host site.
async function boot(): Promise<void> {
  const script = currentScript;
  const siteKey = script?.getAttribute("data-site");
  if (!siteKey) return;
  const apiBase = script?.getAttribute("data-api") ?? __TACTO_API_URL__;

  const payload = await loadPayload(apiBase, siteKey, location.pathname);
  if (!payload) return;

  const begin = () => start(payload, apiBase, siteKey);

  // Expose a consent API so the host site or its CMP can opt in (FR-NGS-05).
  const api = {
    hasConsent,
    grantConsent: () => {
      grantConsent();
      begin();
    },
    revokeConsent,
  };
  (window as unknown as { tacto?: typeof api }).tacto = api;

  if (payload.settings.requireConsent && !hasConsent()) {
    // Wait for consent set via `window.tacto`, a CMP cookie, or localStorage.
    const timer = setInterval(() => {
      if (hasConsent()) {
        clearInterval(timer);
        begin();
      }
    }, 1500);
    return;
  }
  begin();
}

try {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void boot());
  } else {
    void boot();
  }
} catch {
  /* fail-safe: never break the host page */
}
