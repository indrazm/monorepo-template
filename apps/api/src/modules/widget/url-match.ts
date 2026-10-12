// URL targeting (SRS FR-NED-07 / FR-ING-05): All / Simple / Contains / Regex.
export type UrlMatch = { mode: "all" | "simple" | "contains" | "regex"; value?: string };

export function matchUrl(rule: UrlMatch, url: string): boolean {
  switch (rule.mode) {
    case "all":
      return true;
    case "simple":
      // Exact path match ignoring trailing slash and query string.
      return normalize(url) === normalize(rule.value ?? "");
    case "contains":
      return rule.value ? url.includes(rule.value) : false;
    case "regex":
      try {
        return rule.value ? new RegExp(rule.value).test(url) : false;
      } catch {
        return false;
      }
    default:
      return false;
  }
}

function normalize(url: string): string {
  const withoutQuery = url.split("?")[0] ?? url;
  return withoutQuery.replace(/\/+$/, "") || "/";
}
