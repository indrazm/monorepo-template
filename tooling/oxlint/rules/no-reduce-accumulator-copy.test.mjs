import { describe, expect, it } from "bun:test";
import { lint } from "../testing/lint.mjs";

const rule = "no-reduce-accumulator-copy";

describe(`repo/${rule}`, () => {
  it("reports Object.assign({}, acc, ...) returned from reduce", () => {
    expect(
      lint(rule, "const a = xs.reduce((acc, x) => Object.assign({}, acc, { [x]: 1 }), {});"),
    ).toHaveLength(1);
  });

  it("reports acc.concat and acc.slice, in a block body and with reduceRight", () => {
    expect(lint(rule, "const a = xs.reduce((acc, x) => acc.concat([x]), []);")).toHaveLength(1);
    expect(lint(rule, "const a = xs.reduceRight((acc, x) => acc.slice(), []);")).toHaveLength(1);
    expect(
      lint(rule, "const a = xs.reduce(function (acc, x) {\n  return acc.concat(x);\n}, []);"),
    ).toHaveLength(1);
  });

  it("reports copies in either branch of a conditional", () => {
    expect(
      lint(rule, "const a = xs.reduce((acc, x) => (x ? acc.concat(x) : acc), []);"),
    ).toHaveLength(1);
  });

  it("allows mutating and returning the accumulator", () => {
    expect(
      lint(rule, "const a = xs.reduce((acc, x) => {\n  acc.push(x);\n  return acc;\n}, []);"),
    ).toHaveLength(0);
    expect(
      lint(rule, "const a = xs.reduce((acc, x) => Object.assign(acc, { [x]: 1 }), {});"),
    ).toHaveLength(0);
  });

  it("allows spreads, which the native rule covers, and non-reduce callbacks", () => {
    expect(lint(rule, "const a = xs.reduce((acc, x) => [...acc, x], []);")).toHaveLength(0);
    expect(lint(rule, "const a = xs.map((acc) => acc.concat([1]));")).toHaveLength(0);
  });

  it("allows copying something other than the accumulator, and nested callbacks", () => {
    expect(
      lint(rule, "const a = xs.reduce((acc, x) => { acc.push(x.concat(y)); return acc; }, []);"),
    ).toHaveLength(0);
    expect(
      lint(
        rule,
        "const a = xs.reduce((acc, x) => {\n  fs.map((f) => f.concat(acc));\n  return acc;\n}, []);",
      ),
    ).toHaveLength(0);
  });
});
