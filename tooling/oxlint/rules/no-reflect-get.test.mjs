import { describe, expect, it } from "bun:test";
import { lint } from "../testing/lint.mjs";

const rule = "no-reflect-get";

describe(`repo/${rule}`, () => {
  it("reports Reflect.get", () => {
    expect(lint(rule, "const a = Reflect.get(target, key, receiver);")).toHaveLength(1);
  });

  it("reports it inside a Proxy handler and with parentheses", () => {
    expect(
      lint(rule, "const p = new Proxy(t, { get: (o, k) => (Reflect).get(o, k) });"),
    ).toHaveLength(1);
  });

  it("allows other Reflect methods and plain access", () => {
    expect(lint(rule, "const a = Reflect.ownKeys(o);")).toHaveLength(0);
    expect(lint(rule, "const a = target[key];")).toHaveLength(0);
    expect(lint(rule, "const a = map.get(key);")).toHaveLength(0);
  });

  it("ignores a Reflect that is a parameter", () => {
    expect(lint(rule, "const f = (Reflect) => Reflect.get(a, b);")).toHaveLength(0);
  });
});
