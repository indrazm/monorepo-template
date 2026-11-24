import { describe, expect, it } from "bun:test";
import { lint } from "../testing/lint.mjs";

const rule = "no-chained-type-assertions";

describe(`repo/${rule}`, () => {
  it("reports a double assertion", () => {
    expect(lint(rule, "const a = x as unknown as T;")).toHaveLength(1);
    expect(lint(rule, "const a = (x as any) as T;")).toHaveLength(1);
  });

  it("reports an angle-bracket assertion on an assertion", () => {
    expect(lint(rule, "const a = <T>(x as unknown);")).toHaveLength(1);
  });

  it("reports each level of a triple chain", () => {
    expect(lint(rule, "const a = x as A as B as C;")).toHaveLength(2);
  });

  it("allows a single assertion and as const", () => {
    expect(lint(rule, "const a = x as T;")).toHaveLength(0);
    expect(lint(rule, "const a = [1, 2] as const;")).toHaveLength(0);
    expect(lint(rule, "const a = (x as T).y as U;")).toHaveLength(0);
  });

  it("allows as const on top of an assertion, and an assertion on as const", () => {
    expect(lint(rule, "const a = (x as T) as const;")).toHaveLength(0);
    expect(lint(rule, "const a = ([1] as const) as readonly number[];")).toHaveLength(0);
  });
});
