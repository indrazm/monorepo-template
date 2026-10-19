import { describe, expect, it } from "vitest";
import { createSiteSchema, normalizeDomain } from "./sites";

describe("sites contract", () => {
  it("normalizes a pasted URL down to a bare domain (feedback U1)", () => {
    for (const input of [
      "https://demostore.com",
      "http://demostore.com/",
      "https://demostore.com/products?ref=x",
      " demostore.com ",
      "DemoStore.com.",
      "demostore.com/",
    ]) {
      expect(createSiteSchema.parse({ name: "Shop", domain: input }).domain).toBe("demostore.com");
    }
  });

  it("keeps subdomains and www", () => {
    expect(normalizeDomain("https://www.shop.example.com/")).toBe("www.shop.example.com");
    expect(normalizeDomain("SHOP.Example.COM")).toBe("shop.example.com");
  });

  it("rejects values that are not a bare hostname", () => {
    for (const domain of ["not a domain", "localhost", "example", "a_b.com", "http://"]) {
      expect(createSiteSchema.safeParse({ name: "Shop", domain }).success).toBe(false);
    }
  });
});
