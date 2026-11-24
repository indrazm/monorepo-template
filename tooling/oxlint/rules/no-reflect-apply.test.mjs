import { describe, expect, it } from "bun:test";
import { lint } from "../testing/lint.mjs";

const rule = "no-reflect-apply";

describe(`repo/${rule}`, () => {
  it("reports Reflect.apply", () => {
    expect(lint(rule, "const a = Reflect.apply(f, this, args);")).toHaveLength(1);
  });

  it("allows other Reflect methods and function apply", () => {
    expect(lint(rule, "const a = Reflect.has(o, k);")).toHaveLength(0);
    expect(lint(rule, "const a = f.apply(null, args);")).toHaveLength(0);
  });

  it("ignores a local Reflect and a computed access", () => {
    expect(lint(rule, "const Reflect = { apply: f };\nconst a = Reflect.apply(g);")).toHaveLength(
      0,
    );
    expect(lint(rule, 'const a = Reflect["apply"](f);')).toHaveLength(0);
  });
});
