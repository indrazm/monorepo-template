import { describe, expect, it } from "bun:test";
import { lint } from "../testing/lint.mjs";

const rule = "no-atom-import";

describe(`repo/${rule}`, () => {
  it("refuses an atom import from a route or a component", () => {
    const code = 'import { threadsAtom } from "@/modules/threads/atoms/threads-atom";\n';
    expect(lint(rule, code, "apps/web/src/routes/profile.tsx")).toHaveLength(1);
    expect(
      lint(rule, code, "apps/web/src/features/profile/components/profile-page.tsx"),
    ).toHaveLength(1);
  });

  it("allows an atom import from a hook", () => {
    expect(
      lint(
        rule,
        'import { threadsAtom } from "../atoms/threads-atom";\n',
        "apps/web/src/features/auth/hooks/use-auth.ts",
      ),
    ).toHaveLength(0);
  });
});
