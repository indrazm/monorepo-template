import { describe, expect, it } from "bun:test";
import { lint } from "../testing/lint.mjs";

const rule = "no-base-ui-outside-ui";

describe(`repo/${rule}`, () => {
  it("refuses a Base UI import outside packages/ui", () => {
    expect(
      lint(
        rule,
        'import { Slider } from "@base-ui/react/slider";\n',
        "apps/web/src/features/profile/components/profile-page.tsx",
      ),
    ).toHaveLength(1);
  });

  it("allows a Base UI import inside packages/ui", () => {
    expect(
      lint(rule, 'import { Slider } from "@base-ui/react/slider";\n', "packages/ui/src/slider.tsx"),
    ).toHaveLength(0);
  });
});
