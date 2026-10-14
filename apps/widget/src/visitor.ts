// Stable per-browser id (localStorage). Used for live-visitor counting (F33)
// and deterministic A/B bucketing (FR-ANL-04). Fail-safe: never throws.
const VISITOR_KEY = "tacto_vid";

export function visitorId(): string | undefined {
  try {
    const existing = window.localStorage.getItem(VISITOR_KEY);
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
