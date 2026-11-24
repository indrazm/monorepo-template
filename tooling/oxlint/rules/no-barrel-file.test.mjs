import { describe, expect, it } from "bun:test";
import { lint } from "../testing/lint.mjs";

const rule = "no-barrel-file";

describe(`repo/${rule}`, () => {
  it("reports a file of only re-exports", () => {
    expect(lint(rule, 'export * from "./a";\nexport { b } from "./b";\n', "index.ts")).toHaveLength(
      1,
    );
  });

  it("allows a file with its own code next to a re-export", () => {
    expect(lint(rule, 'export * from "./a";\nexport const c = 1;\n', "index.ts")).toHaveLength(0);
  });

  it("allows local exports and an empty file", () => {
    expect(lint(rule, "const a = 1;\nexport { a };\n", "index.ts")).toHaveLength(0);
    expect(lint(rule, "", "index.ts")).toHaveLength(0);
  });
});
