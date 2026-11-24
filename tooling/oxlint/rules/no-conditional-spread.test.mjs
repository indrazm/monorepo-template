import { describe, expect, it } from "bun:test";
import { lint } from "../testing/lint.mjs";

const rule = "no-conditional-spread";

describe(`repo/${rule}`, () => {
  it("reports a spread of an && expression", () => {
    expect(lint(rule, "const a = { ...(c && { d: 1 }) };")).toHaveLength(1);
  });

  it("reports ternary, || and ?? spreads, even in arrays", () => {
    expect(lint(rule, "const a = { ...(c ? { d: 1 } : {}) };")).toHaveLength(1);
    expect(lint(rule, "const a = { ...(c || e) };")).toHaveLength(1);
    expect(lint(rule, "const a = [...(c ?? [])];")).toHaveLength(1);
  });

  it("reports a spread JSX attribute", () => {
    expect(lint(rule, "const a = <div {...(c && p)} />;", "fixture.tsx")).toHaveLength(1);
  });

  it("allows plain spreads and calls", () => {
    expect(lint(rule, "const a = { ...b, ...f() };")).toHaveLength(0);
    expect(lint(rule, "const a = { ...(b.c) };")).toHaveLength(0);
  });
});
