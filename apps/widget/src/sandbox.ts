import type { AnalyticsPassthrough } from "@repo/contracts/sites";

// ---------------------------------------------------------------------------
// Custom JS sandbox (FR-NGS-04).
//
// The site owner's script runs inside an `<iframe sandbox="allow-scripts">`
// with no `allow-same-origin`, so it gets a unique opaque origin: no access to
// the host page's DOM, cookies, localStorage or the Tacto API. The only channel
// is `postMessage`, and only the message types below are honoured — anything
// else is ignored. A thrown error inside the frame cannot break the host page.
//
// What the script can do:
//   window.tacto.on(fn)          observe widget events: view | click | close
//   window.tacto.track(name)     send one custom analytics event back
//   window.tacto.log(message)    write to the console, prefixed
// ---------------------------------------------------------------------------

export type SandboxEvent = {
  event: "view" | "click" | "close";
  id: string;
  type: string;
};

export type Sandbox = {
  emit: (event: SandboxEvent) => void;
  destroy: () => void;
};

const ALLOWED_INBOUND = new Set(["tacto:track", "tacto:log"]);
const MAX_NAME_LENGTH = 60;

// The bootstrap that runs inside the frame and exposes the small API. Kept as
// a string because it is evaluated in the sandboxed document, not here.
const BRIDGE = `
var handlers = [];
window.tacto = {
  on: function (fn) { if (typeof fn === 'function') handlers.push(fn); },
  track: function (name) { parent.postMessage({ type: 'tacto:track', name: String(name) }, '*'); },
  log: function (message) { parent.postMessage({ type: 'tacto:log', message: String(message) }, '*'); }
};
window.addEventListener('message', function (e) {
  var data = e.data;
  if (!data || data.type !== 'tacto:event') return;
  for (var i = 0; i < handlers.length; i++) {
    try { handlers[i](data.event, { id: data.id, type: data.notificationType }); } catch (err) {}
  }
});
`;

export function createSandbox(
  code: string,
  hooks: {
    onTrack: (name: string) => void;
  },
): Sandbox | null {
  if (!code.trim()) return null;
  try {
    const frame = document.createElement("iframe");
    // No allow-same-origin: the frame cannot reach back into this page.
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("aria-hidden", "true");
    frame.setAttribute("title", "Tacto custom code");
    frame.style.display = "none";
    // srcdoc (not src) so there is no network request, and the custom code is
    // wrapped in try/catch so a syntax or runtime error stays contained.
    frame.srcdoc = `<!doctype html><meta charset="utf-8"><script>${BRIDGE}</script><script>try{${code}}catch(e){parent.postMessage({type:'tacto:log',message:'custom JS error: '+e},'*')}</script>`;

    const onMessage = (message: MessageEvent) => {
      if (message.source !== frame.contentWindow) return;
      const data = message.data as { type?: unknown; name?: unknown; message?: unknown };
      if (typeof data?.type !== "string" || !ALLOWED_INBOUND.has(data.type)) return;
      if (data.type === "tacto:track" && typeof data.name === "string") {
        hooks.onTrack(data.name.slice(0, MAX_NAME_LENGTH));
        return;
      }
      if (data.type === "tacto:log" && typeof data.message === "string") {
        console.info("[tacto:custom]", data.message.slice(0, 500));
      }
    };
    window.addEventListener("message", onMessage);
    document.body.appendChild(frame);

    return {
      emit(event) {
        try {
          frame.contentWindow?.postMessage(
            {
              type: "tacto:event",
              event: event.event,
              id: event.id,
              notificationType: event.type,
            },
            "*",
          );
        } catch {
          /* fail-safe */
        }
      },
      destroy() {
        window.removeEventListener("message", onMessage);
        frame.remove();
      },
    };
  } catch {
    // A sandbox that cannot be created simply means no custom code runs.
    return null;
  }
}

// Custom events from the sandbox are forwarded to the host page's analytics
// using the same passthrough settings as widget views/clicks (FR-NGS-06).
export function forwardCustom(settings: AnalyticsPassthrough, name: string): void {
  const payload = { event_category: "tacto", event_label: name };
  try {
    const target = window as unknown as {
      gtag?: (...args: unknown[]) => void;
      dataLayer?: { push: (value: unknown) => void };
      fbq?: (...args: unknown[]) => void;
      mixpanel?: { track?: (name: string, props?: unknown) => void };
    };
    if (settings.gtag && typeof target.gtag === "function") {
      target.gtag("event", `tacto_${name}`, payload);
    }
    if (settings.dataLayer && target.dataLayer) {
      target.dataLayer.push({ event: `tacto_${name}`, ...payload });
    }
    if (settings.fbq && typeof target.fbq === "function") {
      target.fbq("trackCustom", `tacto_${name}`, payload);
    }
    if (settings.mixpanel && typeof target.mixpanel?.track === "function") {
      target.mixpanel.track(`tacto_${name}`, payload);
    }
  } catch {
    /* fail-safe */
  }
}
