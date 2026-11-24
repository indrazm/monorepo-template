import { describe, expect, it } from "vitest";
import { parseWebEnv } from "../src/lib/config";

describe("web configuration", () => {
  it("rejects invalid public API URLs", () => {
    expect(() => parseWebEnv({ VITE_API_URL: "invalid" })).toThrow();
    expect(() => parseWebEnv({ VITE_API_URL: "ftp://example.com" })).toThrow();
  });
});
