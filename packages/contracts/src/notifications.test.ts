import { describe, expect, it } from "vitest";
import { notificationConfigSchema, notificationStyleSchema, urlMatchSchema } from "./notifications";

const validConfig = {
  message: { template: "{{first_name}} from {{city}} just bought {{product}}" },
  style: { position: "bottom-left", accent: "#3B82F6" },
  display: { url: { mode: "all" } },
  dataSource: { eventTypes: ["purchase"] },
  timing: {},
};

describe("notificationConfigSchema", () => {
  it("parses a valid config and applies defaults", () => {
    const result = notificationConfigSchema.parse(validConfig);
    expect(result.message.fallbacks).toEqual({});
    expect(result.style.shape).toBe("rounded");
    expect(result.timing.durationMs).toBe(5000);
  });

  it("rejects an invalid accent color", () => {
    expect(() =>
      notificationStyleSchema.parse({ position: "bottom-left", accent: "blue" }),
    ).toThrow();
  });
});

describe("urlMatchSchema", () => {
  it("requires a value unless mode is all", () => {
    expect(urlMatchSchema.safeParse({ mode: "contains" }).success).toBe(false);
    expect(urlMatchSchema.safeParse({ mode: "contains", value: "/pricing" }).success).toBe(true);
    expect(urlMatchSchema.safeParse({ mode: "all" }).success).toBe(true);
  });
});
