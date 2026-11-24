import { describe, expect, it } from "bun:test";
import { lint } from "../testing/lint.mjs";

const rule = "no-comments";

describe(`repo/${rule}`, () => {
  it("reports line, block and trailing comments in TypeScript", () => {
    expect(lint(rule, "// hi\nconst a = 1;\n")).toHaveLength(1);
    expect(lint(rule, "/* hi */\nconst a = 1;\n")).toHaveLength(1);
    expect(lint(rule, "const a = 1; // hi\n")).toHaveLength(1);
    expect(lint(rule, "// a\n// b\nconst a = 1;\n", "fixture.tsx")).toHaveLength(2);
  });

  it("allows code without comments", () => {
    expect(lint(rule, "const a = 1;\n")).toHaveLength(0);
  });

  it("allows tool directives and a shebang", () => {
    expect(lint(rule, "// @ts-expect-error\nconst a: number = 'x';\n")).toHaveLength(0);
    expect(lint(rule, "// oxlint-disable-next-line no-var\nvar a = 1;\n")).toHaveLength(0);
    expect(lint(rule, '/// <reference types="bun" />\nconst a = 1;\n')).toHaveLength(0);
    expect(lint(rule, "#!/usr/bin/env bun\nconst a = 1;\n")).toHaveLength(0);
  });

  it("ignores files that are not TypeScript", () => {
    expect(lint(rule, "// hi\nconst a = 1;\n", "fixture.mjs")).toHaveLength(0);
  });
});
