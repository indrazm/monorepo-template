// GDPR consent gate (SRS FR-NGS-05). The host site (or its CMP) can grant
// consent by setting the `tacto_consent=1` cookie, by calling
// `window.tacto.grantConsent()`, or by writing `localStorage.tacto_consent="1"`.
const CONSENT_KEY = "tacto_consent";
const MAX_AGE_SECONDS = 365 * 86_400;

function readCookie(name: string): string | null {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

export function hasConsent(): boolean {
  try {
    if (readCookie(CONSENT_KEY) === "1") return true;
    return window.localStorage.getItem(CONSENT_KEY) === "1";
  } catch {
    return false;
  }
}

export function grantConsent(): void {
  try {
    document.cookie = `${CONSENT_KEY}=1; max-age=${MAX_AGE_SECONDS}; path=/; SameSite=Lax`;
    window.localStorage.setItem(CONSENT_KEY, "1");
  } catch {
    /* fail-safe */
  }
}

const revokeListeners = new Set<() => void>();

// Lets the runtime tear down rendering and tracking when consent is withdrawn.
export function onConsentRevoked(listener: () => void): () => void {
  revokeListeners.add(listener);
  return () => revokeListeners.delete(listener);
}

export function revokeConsent(): void {
  try {
    document.cookie = `${CONSENT_KEY}=; max-age=0; path=/`;
    window.localStorage.removeItem(CONSENT_KEY);
  } catch {
    /* fail-safe */
  }
  for (const listener of revokeListeners) {
    try {
      listener();
    } catch {
      /* a listener must not break consent revocation */
    }
  }
}
