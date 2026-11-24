import { describe, expect, it } from "bun:test";
import { lint } from "../testing/lint.mjs";

const rule = "no-array-filter-map";

describe(`repo/${rule}`, () => {
  it("reports filter then map and map then filter", () => {
    expect(lint(rule, "const a = xs.filter(f).map(g);")).toHaveLength(1);
    expect(lint(rule, "const a = xs.map(g).filter(f);")).toHaveLength(1);
  });

  it("reports across lines, optional chains and filter(Boolean)", () => {
    expect(lint(rule, "const a = xs\n  .filter(Boolean)\n  .map(g);")).toHaveLength(1);
    expect(lint(rule, "const a = xs?.filter(f).map(g);")).toHaveLength(1);
  });

  it("allows other chains and separate statements", () => {
    expect(lint(rule, "const a = xs.flatMap(g);")).toHaveLength(0);
    expect(lint(rule, "const a = xs.map(f).map(g);")).toHaveLength(0);
    expect(lint(rule, "const a = xs.filter(f).filter(g);")).toHaveLength(0);
    expect(lint(rule, "const a = xs.filter(f).slice(1).map(g);")).toHaveLength(0);
    expect(lint(rule, "const b = xs.filter(f);\nconst a = b.map(g);")).toHaveLength(0);
  });

  it("allows a map inside the filter callback argument", () => {
    expect(lint(rule, "const a = xs.filter((x) => ys.map(g).length > 0);")).toHaveLength(0);
  });
});
