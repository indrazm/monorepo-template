import { attachCapture } from "./capture";
import { grantConsent, hasConsent, onConsentRevoked, revokeConsent } from "./consent";
import { debug } from "./debug";
import { mountInline } from "./inline";
import { loadConfig, loadPayload } from "./loader";
import { forwardAnalytics } from "./passthrough";
import { startScheduler } from "./scheduler";
import { createSandbox, forwardCustom } from "./sandbox";
import { createShadowHost } from "./shadow";
import { claimSpin } from "./spin";
import { track } from "./track";
import { visit } from "./visit";
import type { WidgetNotification, WidgetPayloadResponse } from "@repo/contracts/widget";

// Captured at synchronous eval time (document.currentScript is null later).
const currentScript =
  (document.currentScript as HTMLScriptElement | null) ??
  document.querySelector<HTMLScriptElement>("script[data-site]");

let started = false;

// Boots rendering + tracking once. Under consent mode this runs only after the
// visitor (or their CMP) grants consent (SRS FR-NGS-05).
function start(payload: WidgetPayloadResponse, apiBase: string, siteKey: string): () => void {
  if (started) return () => undefined;
  started = true;

  // One pageview per session feeds the traffic quota (FR-BIL-01).
  visit(apiBase, siteKey);

  // Auto-capture is independent of having notifications to show.
  const cleanupCapture = attachCapture(apiBase, siteKey);
  let cleanupInline: () => void = () => undefined;
  const stopSchedulers: (() => void)[] = [];
  const cleanup = () => {
    for (const stop of stopSchedulers) stop();
    cleanupInline();
    cleanupCapture();
    started = false;
  };

  // Over the monthly visitor quota the API serves no notifications (FR-BIL-01).
  // The host page is left untouched on purpose — a visitor should never see an
  // upgrade prompt for someone else's plan — but the owner gets a clear console
  // notice when they look at their own site.
  if (payload.settings.overQuota) {
    debug.log("Over the monthly visitor quota — notifications paused.");
    console.warn(
      `[tacto] Monthly visitor quota reached — notifications are paused.${
        payload.settings.upgradeUrl ? ` Upgrade: ${payload.settings.upgradeUrl}` : ""
      }`,
    );
    return cleanup;
  }

  if (payload.notifications.length === 0) {
    debug.log(
      "No notifications matched this page. Check targeting (URL/visitor/geo), that a notification is active, and that matching events exist.",
    );
    return cleanup;
  }
  debug.log(
    `Serving ${payload.notifications.length} notification(s):`,
    payload.notifications.map((n) => ({ id: n.id, type: n.type })),
  );

  // Custom JS, isolated in a cross-origin sandbox iframe (FR-NGS-04). It only
  // observes widget events and may send one custom analytics event back.
  const sandbox = payload.settings.customJs
    ? createSandbox(payload.settings.customJs, {
        onTrack: (name) => forwardCustom(payload.settings.analyticsPassthrough, name),
      })
    : null;
  const typeOf = (refId: string) =>
    payload.notifications.find((item) => item.id === refId)?.type ?? "";

  // Shared event handlers, reused by the floating scheduler and inline mounts.
  const emitView = (refId: string, variantId?: string) => {
    debug.log("Shown:", refId, variantId ? `(variant ${variantId})` : "");
    track(apiBase, { site: siteKey, refId, kind: "view", variantId });
    forwardAnalytics(payload.settings, "view", refId);
    sandbox?.emit({ event: "view", id: refId, type: typeOf(refId) });
  };
  const emitClick = (refId: string, variantId?: string) => {
    debug.log("Clicked:", refId);
    track(apiBase, { site: siteKey, refId, kind: "click", variantId });
    forwardAnalytics(payload.settings, "click", refId);
    sandbox?.emit({ event: "click", id: refId, type: typeOf(refId) });
  };
  const emitClaim = (refId: string, variantId?: string) => {
    // A spin reward was won and handed to the visitor (F69): record the claim
    // as a first-class outcome so it shows up in analytics and goals.
    track(apiBase, { site: siteKey, refId, kind: "claim", variantId });
    forwardAnalytics(payload.settings, "claim", refId);
    sandbox?.emit({ event: "click", id: refId, type: typeOf(refId) });
  };
  const onSpinClaim = (refId: string) => claimSpin(apiBase, siteKey, refId);

  // Inline social proof (feedback T8): notifications with a target selector are
  // embedded in the page; the rest float and cycle through the scheduler.
  const inlineNotifs = payload.notifications.filter((item) => item.inlineSelector);
  const floating = payload.notifications.filter((item) => !item.inlineSelector);

  if (inlineNotifs.length > 0) {
    cleanupInline = mountInline({
      notifications: inlineNotifs,
      showBadge: payload.settings.showBadge,
      onView: emitView,
      onClick: emitClick,
      onClaim: emitClaim,
      onSpinClaim,
    });
  }

  if (floating.length === 0) return cleanup;

  // One host per position: a bar and a corner card must not share the same
  // stack (their CSS anchors differ). Each group runs its own scheduler.
  const byPosition = new Map<string, WidgetNotification[]>();
  for (const notification of floating) {
    const position = notification.style.position;
    const group = byPosition.get(position) ?? [];
    group.push(notification);
    byPosition.set(position, group);
  }

  for (const [position, notifications] of byPosition) {
    const host = createShadowHost(position);
    // Per-domain custom CSS, scoped to the widget's shadow root (FR-NGS-04).
    if (payload.settings.customCss) {
      const custom = document.createElement("style");
      custom.textContent = payload.settings.customCss;
      host.root.appendChild(custom);
    }
    stopSchedulers.push(
      startScheduler({
        host,
        siteKey,
        notifications,
        settings: payload.settings,
        onView: emitView,
        onClick: emitClick,
        onClaim: emitClaim,
        onSpinClaim,
      }),
    );
  }
  return cleanup;
}

// Entry for the Tacto pixel. Reads config from its own <script> tag and boots
// the widget. Everything is wrapped so a failure never breaks the host site.
async function boot(): Promise<void> {
  const script = currentScript;
  const siteKey = script?.getAttribute("data-site");
  if (!siteKey) return;
  const apiBase = script?.getAttribute("data-api") ?? __TACTO_API_URL__;

  // Ask only for the consent requirement first. No visitor id, page URL,
  // referrer, query string or beacon is sent before consent is granted.
  const config = await loadConfig(apiBase, siteKey);
  if (!config) {
    debug.log("No config returned (site not found or network error).");
    return;
  }

  let stop: (() => void) | null = null;
  let starting = false;
  let consentTimer: ReturnType<typeof setInterval> | null = null;

  const begin = async () => {
    if (started || starting) return;
    if (config.requireConsent && !hasConsent()) return;
    if (consentTimer) {
      clearInterval(consentTimer);
      consentTimer = null;
    }
    starting = true;
    debug.log("Fetching payload for", siteKey, "on", location.pathname);
    const payload = await loadPayload(apiBase, siteKey, location.pathname);
    starting = false;
    if (!payload) {
      debug.log("No payload returned (site not found, blocked origin, or network error).");
      return;
    }
    stop = start(payload, apiBase, siteKey);
  };

  // Withdrawing consent tears down the scheduler, inline mounts and capture
  // listener; a later grant can boot the widget again.
  onConsentRevoked(() => {
    stop?.();
    stop = null;
  });

  // Expose a consent API so the host site or its CMP can opt in (FR-NGS-05).
  const api = {
    hasConsent,
    grantConsent: () => {
      grantConsent();
      void begin();
    },
    revokeConsent: () => {
      revokeConsent();
      // Consent is not required: revoking it does not change tracking.
      if (!config.requireConsent) void begin();
    },
  };
  (window as unknown as { tacto?: typeof api }).tacto = api;

  if (config.requireConsent && !hasConsent()) {
    // Wait for consent set via `window.tacto`, a CMP cookie, or localStorage.
    consentTimer = setInterval(() => {
      if (hasConsent()) void begin();
    }, 1500);
    return;
  }
  await begin();
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
