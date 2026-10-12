import type { CaptureEventInput } from "@repo/contracts/widget";

// Auto-captures form submissions on the host page and forwards the named fields
// to the ingest endpoint (SRS FR-ING-01). Fail-safe and non-blocking.
export function attachCapture(apiBase: string, siteKey: string): void {
  document.addEventListener(
    "submit",
    (domEvent) => {
      try {
        const form = domEvent.target as HTMLFormElement | null;
        if (!form || form.tagName !== "FORM") return;
        const fields: Record<string, string> = {};
        for (const element of Array.from(form.elements)) {
          const input = element as HTMLInputElement;
          if (!input.name || input.type === "password" || input.type === "hidden") continue;
          if (typeof input.value === "string" && input.value.length <= 200) {
            fields[input.name] = input.value;
          }
        }
        const body: CaptureEventInput = { site: siteKey, url: location.pathname, fields };
        const url = `${apiBase}/widget/v1/capture`;
        const payload = JSON.stringify(body);
        if (navigator.sendBeacon) {
          navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
        } else {
          void fetch(url, { method: "POST", body: payload, keepalive: true, credentials: "omit" });
        }
      } catch {
        /* fail-safe */
      }
    },
    true,
  );
}
