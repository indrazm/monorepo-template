import { describe, expect, it } from "bun:test";
import { lint } from "../testing/lint.mjs";

const rule = "no-native-primitives";

describe(`repo/${rule}`, () => {
  it("reports a native button", () => {
    const messages = lint(rule, "const a = <button>hi</button>;", "fixture.tsx");

    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("<button>");
  });

  it("reports self-closing native elements", () => {
    expect(lint(rule, "const a = <input />;", "fixture.tsx")).toHaveLength(1);
  });

  it("allows components, other tags and member names", () => {
    expect(lint(rule, "const a = <Button />;", "fixture.tsx")).toHaveLength(0);
    expect(lint(rule, "const a = <div><span /></div>;", "fixture.tsx")).toHaveLength(0);
    expect(lint(rule, "const a = <Form.Button />;", "fixture.tsx")).toHaveLength(0);
  });
});
