import { attachCapture } from "./capture";
import { loadPayload } from "./loader";
import { forwardAnalytics } from "./passthrough";
import { startScheduler } from "./scheduler";
import { createShadowHost } from "./shadow";
import { track } from "./track";

// Captured at synchronous eval time (document.currentScript is null later).
const currentScript =
  (document.currentScript as HTMLScriptElement | null) ??
  document.querySelector<HTMLScriptElement>("script[data-site]");

// Entry for the Tacto pixel. Reads config from its own <script> tag and boots
// the widget. Everything is wrapped so a failure never breaks the host site.
async function boot(): Promise<void> {
  const script = currentScript;
  const siteKey = script?.getAttribute("data-site");
  if (!siteKey) return;
  const apiBase = script?.getAttribute("data-api") ?? __TACTO_API_URL__;

  // Auto-capture is independent of having notifications to show.
  attachCapture(apiBase, siteKey);

  const payload = await loadPayload(apiBase, siteKey, location.pathname);
  if (!payload || payload.notifications.length === 0) return;

  const position = payload.notifications[0]?.style.position ?? "bottom-left";
  const host = createShadowHost(position);

  // Per-domain custom CSS, scoped to the widget's shadow root (FR-NGS-04).
  if (payload.settings.customCss) {
    const custom = document.createElement("style");
    custom.textContent = payload.settings.customCss;
    host.root.appendChild(custom);
  }
  startScheduler({
    host,
    siteKey,
    notifications: payload.notifications,
    settings: payload.settings,
    onView: (refId) => {
      track(apiBase, { site: siteKey, refId, kind: "view" });
      forwardAnalytics(payload.settings, "view", refId);
    },
    onClick: (refId) => {
      track(apiBase, { site: siteKey, refId, kind: "click" });
      forwardAnalytics(payload.settings, "click", refId);
    },
  });
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
