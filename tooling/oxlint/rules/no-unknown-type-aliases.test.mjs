import { describe, expect, it } from "bun:test";
import { lint } from "../testing/lint.mjs";

const rule = "no-unknown-type-aliases";

describe(`repo/${rule}`, () => {
  it("reports an alias of unknown", () => {
    expect(lint(rule, "type Json = unknown;")).toHaveLength(1);
    expect(lint(rule, "export type Value<T> = unknown;")).toHaveLength(1);
  });

  it("allows real types and unknown in other positions", () => {
    expect(lint(rule, "type A = string;")).toHaveLength(0);
    expect(lint(rule, "type A = unknown[];")).toHaveLength(0);
    expect(lint(rule, "type A = { x: unknown };")).toHaveLength(0);
    expect(lint(rule, "type A<T> = T | unknown;")).toHaveLength(0);
  });
});
