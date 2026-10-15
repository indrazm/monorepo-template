// Browsers hitting an ngrok dev tunnel get an interstitial page unless this
// header is present. Tacto's public test URL (VITE_PUBLIC_API_URL) is often an
// ngrok tunnel, so we send it only when the API host looks like one — harmless
// everywhere else. Everything here is fail-safe (SRS NFR-REL-02).
export function tunnelHeaders(apiBase: string): Record<string, string> {
  return /(^|\.)ngrok(-free)?\.(dev|io|app)$/.test(hostOf(apiBase))
    ? { "ngrok-skip-browser-warning": "true" }
    : {};
}

function hostOf(value: string): string {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return "";
  }
}

// Fire-and-forget POST used by the visit/capture/track beacons. `sendBeacon`
// cannot set the tunnel header, so when the API is a tunnel we fall back to a
// keepalive fetch (which can).
export function postBeacon(apiBase: string, path: string, payload: string): void {
  try {
    const headers = tunnelHeaders(apiBase);
    const url = `${apiBase}${path}`;
    if (navigator.sendBeacon && Object.keys(headers).length === 0) {
      navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
      return;
    }
    void fetch(url, {
      method: "POST",
      body: payload,
      keepalive: true,
      credentials: "omit",
      headers: { "Content-Type": "application/json", ...headers },
    });
  } catch {
    /* fail-safe */
  }
}
