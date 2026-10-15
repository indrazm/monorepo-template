import { describe, expect, it } from "vitest";
import { notificationDisplaySchema } from "@repo/contracts/notifications";
import { matchesTargeting, parseParams, targetingCacheKey } from "./targeting";

function display(input: Record<string, unknown>) {
  return notificationDisplaySchema.parse({ url: { mode: "all" }, ...input });
}

describe("display targeting (FR-NED-07)", () => {
  it("shows everywhere when no rule is set", () => {
    expect(matchesTargeting(display({}), { url: "/pricing" })).toBe(true);
  });

  it("still applies URL and country rules", () => {
    const rule = display({ url: { mode: "contains", value: "/pricing" }, countries: ["ID"] });
    expect(matchesTargeting(rule, { url: "/pricing", country: "ID" })).toBe(true);
    expect(matchesTargeting(rule, { url: "/blog", country: "ID" })).toBe(false);
    expect(matchesTargeting(rule, { url: "/pricing", country: "SG" })).toBe(false);
    // Unknown geo fails open — we cannot filter what we cannot determine.
    expect(matchesTargeting(rule, { url: "/pricing", country: null })).toBe(true);
  });

  it("requires every configured UTM parameter to match", () => {
    const rule = display({ utm: { utm_source: "newsletter", utm_medium: "email" } });
    expect(
      matchesTargeting(rule, {
        url: "/",
        params: { utm_source: "newsletter", utm_medium: "email", utm_campaign: "spring" },
      }),
    ).toBe(true);
    // One missing parameter is enough to exclude it.
    expect(matchesTargeting(rule, { url: "/", params: { utm_source: "newsletter" } })).toBe(false);
    // Matching is case-insensitive on the value.
    expect(
      matchesTargeting(rule, {
        url: "/",
        params: { utm_source: "Newsletter", utm_medium: "EMAIL" },
      }),
    ).toBe(true);
    // No campaign parameters at all.
    expect(matchesTargeting(rule, { url: "/" })).toBe(false);
  });

  it("matches the referrer by contains and regex", () => {
    const contains = display({ referrer: { mode: "contains", value: "google." } });
    expect(matchesTargeting(contains, { url: "/", referrer: "https://www.google.com/" })).toBe(
      true,
    );
    expect(matchesTargeting(contains, { url: "/", referrer: "https://bing.com/" })).toBe(false);
    // A referrer rule cannot match direct traffic.
    expect(matchesTargeting(contains, { url: "/", referrer: null })).toBe(false);

    const regex = display({ referrer: { mode: "regex", value: "^https://(news|blog)\\." } });
    expect(matchesTargeting(regex, { url: "/", referrer: "https://news.example.com/a" })).toBe(
      true,
    );
    expect(matchesTargeting(regex, { url: "/", referrer: "https://shop.example.com" })).toBe(false);

    // A malformed pattern never throws and never matches.
    const broken = display({ referrer: { mode: "regex", value: "([" } });
    expect(matchesTargeting(broken, { url: "/", referrer: "https://x.test" })).toBe(false);
  });

  it("accepts a bare referrer string from older notifications", () => {
    const rule = display({ referrer: "producthunt.com" });
    expect(matchesTargeting(rule, { url: "/", referrer: "https://producthunt.com/posts/x" })).toBe(
      true,
    );
  });

  it("segments new and returning visitors", () => {
    const newcomers = display({ visitor: "new" });
    expect(matchesTargeting(newcomers, { url: "/", visitor: "new" })).toBe(true);
    expect(matchesTargeting(newcomers, { url: "/", visitor: "returning" })).toBe(false);
    // Pixel did not report a segment → fail open.
    expect(matchesTargeting(newcomers, { url: "/", visitor: null })).toBe(true);

    const regulars = display({ visitor: "returning" });
    expect(matchesTargeting(regulars, { url: "/", visitor: "returning" })).toBe(true);
    expect(matchesTargeting(regulars, { url: "/", visitor: "new" })).toBe(false);
  });

  it("parses and bounds the landing query string", () => {
    expect(parseParams("?utm_source=x&UTM_Medium=Email")).toEqual({
      utm_source: "x",
      utm_medium: "Email",
    });
    expect(parseParams(null)).toEqual({});
    const many = Array.from({ length: 40 }, (_, i) => `p${i}=1`).join("&");
    expect(Object.keys(parseParams(many)).length).toBe(20);
  });

  it("keys the payload cache only on what can change targeting", () => {
    const a = targetingCacheKey({
      url: "/",
      params: { utm_source: "ads", session: "abc" },
      referrer: "https://google.com/search?q=secret",
      visitor: "new",
    });
    const b = targetingCacheKey({
      url: "/other",
      params: { utm_source: "ads", session: "zzz" },
      referrer: "https://google.com/other",
      visitor: "new",
    });
    // Noise params, the referrer path and the URL are not part of the key.
    expect(a).toBe(b);
    expect(a).toContain("utm_source=ads");
    expect(a).toContain("google.com");

    const different = targetingCacheKey({ url: "/", params: { utm_source: "seo" } });
    expect(different).not.toBe(a);
  });
});
