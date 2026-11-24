import { describe, expect, it } from "bun:test";
import { lint } from "../testing/lint.mjs";

const rule = "no-ui-primitives-outside-ui";

describe(`repo/${rule}`, () => {
  it("refuses radix-ui and Base UI imports outside packages/ui", () => {
    expect(
      lint(
        rule,
        'import { Dialog } from "radix-ui";\n',
        "apps/web/src/features/profile/components/profile-page.tsx",
      ),
    ).toHaveLength(1);
    expect(
      lint(
        rule,
        'import { Root } from "@radix-ui/react-dialog";\n',
        "apps/web/src/features/profile/components/profile-page.tsx",
      ),
    ).toHaveLength(1);
    expect(
      lint(
        rule,
        'import { Slider } from "@base-ui/react/slider";\n',
        "apps/web/src/features/profile/components/profile-page.tsx",
      ),
    ).toHaveLength(1);
  });

  it("allows primitive imports inside packages/ui", () => {
    expect(
      lint(
        rule,
        'import { Dialog } from "radix-ui";\n',
        "packages/ui/src/components/ui/dialog.tsx",
      ),
    ).toHaveLength(0);
    expect(
      lint(
        rule,
        'import { Slider } from "@base-ui/react/slider";\n',
        "packages/ui/src/components/ui/slider.tsx",
      ),
    ).toHaveLength(0);
  });
});
