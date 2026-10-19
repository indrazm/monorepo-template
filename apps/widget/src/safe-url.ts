// Returns true only for absolute http(s) URLs. Notification data is validated
// at the API boundary, but older rows and cached payloads are not trusted:
// `javascript:`/`data:` URLs must never reach href/src/window.open.
export function isSafeHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
