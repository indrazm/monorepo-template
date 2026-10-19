// Debug/test mode for the pixel (feedback T5). Enabled by adding
// `?tacto_debug=1` to the page URL, or by setting `localStorage.tacto_debug`.
// When on, the pixel narrates its lifecycle to the console so an installer can
// see why a notification did or did not appear. Never throws.
function detect(): boolean {
  try {
    if (/[?&]tacto_debug=1\b/.test(location.search)) return true;
    return localStorage.getItem("tacto_debug") === "1";
  } catch {
    return false;
  }
}

const enabled = detect();

export const debug = {
  enabled,
  log(...args: unknown[]): void {
    if (!enabled) return;
    try {
      console.info("%c[tacto:debug]", "color:#3B82F6;font-weight:bold", ...args);
    } catch {
      /* fail-safe */
    }
  },
};
