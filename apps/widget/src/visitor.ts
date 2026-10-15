// Stable per-browser id (localStorage). Used for live-visitor counting (F33),
// deterministic A/B bucketing (FR-ANL-04), the monthly visitor quota
// (FR-BIL-01) and new-vs-returning targeting (FR-NED-07). Fail-safe: never
// throws.
const VISITOR_KEY = "tacto_vid";

// Whether this browser was already known when the pixel first looked. Captured
// once, so it stays correct no matter which function runs first (visitorId()
// writes the key, which would otherwise make every visitor look "returning").
let knownOnLoad: boolean | null = null;

function remember(existing: string | null): void {
  if (knownOnLoad === null) knownOnLoad = Boolean(existing);
}

export function visitorId(): string | undefined {
  try {
    const existing = window.localStorage.getItem(VISITOR_KEY);
    remember(existing);
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(VISITOR_KEY, id);
    return id;
  } catch {
    return undefined;
  }
}

export function isReturningVisitor(): boolean {
  if (knownOnLoad === null) {
    try {
      remember(window.localStorage.getItem(VISITOR_KEY));
    } catch {
      knownOnLoad = false;
    }
  }
  return knownOnLoad === true;
}
