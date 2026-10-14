import { describe, expect, it } from "vitest";
import { renderMessage, timeAgo } from "./template";

describe("renderMessage", () => {
  it("substitutes variables, keeps first name only, and capitalizes", () => {
    const text = renderMessage(
      { template: "{{first_name}} from {{city}} bought {{product}}", fallbacks: {} },
      { first_name: "mike jones", city: "london", product: "Nike Air" },
    );
    expect(text).toBe("Mike from London bought Nike Air");
  });

  it("uses fallbacks for empty variables and trims leftover gaps", () => {
    const text = renderMessage(
      { template: "{{first_name}} from {{city}}", fallbacks: { city: "somewhere" } },
      { first_name: "ana", city: "" },
    );
    expect(text).toBe("Ana from somewhere");
  });

  it("drops a variable with no value and no fallback", () => {
    const text = renderMessage(
      { template: "Someone {{city}} just signed up", fallbacks: {} },
      { city: "" },
    );
    expect(text).toBe("Someone just signed up");
  });

  it("uses a translation matching the visitor locale, else the base template", () => {
    const message = {
      template: "{{first_name}} just bought {{product}}",
      fallbacks: {},
      translations: {
        id: { template: "{{first_name}} baru saja membeli {{product}}", fallbacks: {} },
      },
    };
    expect(renderMessage(message, { first_name: "siti", product: "Sepatu" }, "id-ID")).toBe(
      "Siti baru saja membeli Sepatu",
    );
    expect(renderMessage(message, { first_name: "siti", product: "Sepatu" }, "de")).toBe(
      "Siti just bought Sepatu",
    );
  });
});

describe("timeAgo", () => {
  it("formats minutes and collapses past the horizon to 'recently'", () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60_000);
    expect(timeAgo(fiveMinutesAgo)).toBe("5 minutes ago");
    const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000);
    expect(timeAgo(tenDaysAgo, 7)).toBe("recently");
  });
});
