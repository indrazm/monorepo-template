// Lightweight User-Agent classification for the analytics audience breakdown
// (FR-ANL-02). Deliberately coarse — just enough to bucket device/browser and
// flag obvious bots — so no UA database or dependency is needed on the hot path.

const BOT_RE =
  /bot|crawl|spider|slurp|mediapartners|facebookexternalhit|embedly|quora link preview|pinterest|bitlybot|headless|phantomjs|lighthouse|monitor|uptime|preview|curl|wget|python-requests|axios|node-fetch/i;

export function classifyUserAgent(userAgent: string | null | undefined): {
  device: string;
  browser: string;
  isBot: boolean;
} {
  const ua = userAgent ?? "";
  const isBot = ua === "" || BOT_RE.test(ua);

  const device = /ipad|tablet|playbook|silk/i.test(ua)
    ? "Tablet"
    : /mobi|iphone|android.*mobile|phone/i.test(ua)
      ? "Mobile"
      : "Desktop";

  const browser = /edg(a|ios)?\//i.test(ua)
    ? "Edge"
    : /opr\/|opera/i.test(ua)
      ? "Opera"
      : /chrome|crios|chromium/i.test(ua)
        ? "Chrome"
        : /firefox|fxios/i.test(ua)
          ? "Firefox"
          : /safari/i.test(ua)
            ? "Safari"
            : "Other";

  return { device, browser, isBot };
}

// The pathname of a reported page URL, so "top pages" groups by path and not by
// the full URL with its query string. Falls back to the raw (trimmed) value.
export function pathOf(url: string | null | undefined): string | null {
  if (!url) return null;
  const raw = url.trim();
  if (raw === "") return null;
  try {
    return new URL(raw, "https://placeholder.local").pathname || "/";
  } catch {
    return raw.slice(0, 2048);
  }
}
