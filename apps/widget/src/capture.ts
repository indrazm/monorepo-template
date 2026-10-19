import type { CaptureEventInput } from "@repo/contracts/widget";
import { postBeacon } from "./net";

// Auto-captures form submissions on the host page and forwards the named fields
// to the ingest endpoint (SRS FR-ING-01). Fail-safe and non-blocking.
export function attachCapture(apiBase: string, siteKey: string): () => void {
  const onSubmit = (domEvent: Event) => {
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
      postBeacon(apiBase, "/widget/v1/capture", JSON.stringify(body));
    } catch {
      /* fail-safe */
    }
  };
  document.addEventListener("submit", onSubmit, true);
  return () => document.removeEventListener("submit", onSubmit, true);
}
