import { describe, expect, it } from "vitest";
import {
  clickActionSchema,
  notificationConfigSchema,
  notificationDataSourceSchema,
  notificationMediaSchema,
  notificationStyleSchema,
  spinPrizeSchema,
  urlMatchSchema,
} from "./notifications";

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

describe("browser URL validation", () => {
  it("accepts http(s) URLs", () => {
    expect(clickActionSchema.safeParse({ type: "url", url: "https://example.com" }).success).toBe(
      true,
    );
    expect(
      notificationMediaSchema.safeParse({ imageUrl: "http://example.com/a.png" }).success,
    ).toBe(true);
  });

  it("rejects javascript and data URLs in click actions", () => {
    for (const url of ["javascript:alert(1)", "data:text/html,<script>alert(1)</script>"]) {
      expect(clickActionSchema.safeParse({ type: "url", url }).success).toBe(false);
    }
  });

  it("rejects unsafe prize and media URLs", () => {
    expect(spinPrizeSchema.safeParse({ label: "Prize", url: "javascript:alert(1)" }).success).toBe(
      false,
    );
    expect(
      notificationMediaSchema.safeParse({ imageUrl: "data:text/html,<script>alert(1)</script>" })
        .success,
    ).toBe(false);
  });
});

describe("notificationDataSourceSchema", () => {
  it("accepts an optional source and field filters (FR-NED-08)", () => {
    const parsed = notificationDataSourceSchema.parse({
      eventTypes: ["purchase"],
      source: "stripe",
      filters: [
        { field: "product", op: "contains", value: "Pro" },
        { field: "amount", op: "gte", value: "50" },
      ],
    });
    expect(parsed.source).toBe("stripe");
    expect(parsed.filters).toHaveLength(2);
  });

  it("defaults the operator and rejects an empty field", () => {
    expect(
      notificationDataSourceSchema.parse({ filters: [{ field: "x", value: "y" }] }).filters?.[0].op,
    ).toBe("eq");
    expect(
      notificationDataSourceSchema.safeParse({ filters: [{ field: "", value: "y" }] }).success,
    ).toBe(false);
  });
});

describe("urlMatchSchema", () => {
  it("requires a value unless mode is all", () => {
    expect(urlMatchSchema.safeParse({ mode: "contains" }).success).toBe(false);
    expect(urlMatchSchema.safeParse({ mode: "contains", value: "/pricing" }).success).toBe(true);
    expect(urlMatchSchema.safeParse({ mode: "all" }).success).toBe(true);
  });
});
