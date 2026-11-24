import { describe, expect, it } from "bun:test";
import { lint, lintFix } from "../testing/lint.mjs";

const rule = "padded-if";

describe(`repo/${rule}`, () => {
  it("reports an if with no blank line above and below", () => {
    const messages = lint(rule, "const a = 1;\nif (a) {\n  f();\n}\nconst b = 2;\n");

    expect(messages).toHaveLength(2);
  });

  it("allows padded ifs", () => {
    expect(lint(rule, "const a = 1;\n\nif (a) {\n  f();\n}\n\nconst b = 2;\n")).toHaveLength(0);
  });

  it("allows an if at the start or end of a block or case", () => {
    expect(lint(rule, "function f() {\n  if (a) {\n    g();\n  }\n}\n")).toHaveLength(0);
    expect(
      lint(rule, "switch (a) {\n  case 1:\n    if (b) {\n      g();\n    }\n}\n"),
    ).toHaveLength(0);
  });

  it("reports an if followed by more statements in a case", () => {
    expect(
      lint(rule, "switch (a) {\n  case 1:\n    if (b) {\n      g();\n    }\n    break;\n}\n"),
    ).toHaveLength(1);
  });

  it("ignores an else-if, which is not a statement of a block", () => {
    expect(
      lint(rule, "function f() {\n  if (a) {\n    g();\n  } else if (b) {\n    h();\n  }\n}\n"),
    ).toHaveLength(0);
  });

  it("fixes by inserting blank lines", () => {
    expect(lintFix(rule, "const a = 1;\nif (a) {\n  f();\n}\nconst b = 2;\n")).toBe(
      "const a = 1;\n\nif (a) {\n  f();\n}\n\nconst b = 2;\n",
    );
  });
});
