import noArrayFilterMap from "./rules/no-array-filter-map.mjs";
import noBarrelFile from "./rules/no-barrel-file.mjs";
import noChainedTypeAssertions from "./rules/no-chained-type-assertions.mjs";
import noConditionalSpread from "./rules/no-conditional-spread.mjs";
import noModuleMocking from "./rules/no-module-mocking.mjs";
import noNativePrimitives from "./rules/no-native-primitives.mjs";
import noReduceAccumulatorCopy from "./rules/no-reduce-accumulator-copy.mjs";
import noReflectApply from "./rules/no-reflect-apply.mjs";
import noReflectGet from "./rules/no-reflect-get.mjs";
import noUiPrimitivesOutsideUi from "./rules/no-ui-primitives-outside-ui.mjs";
import noUnknownTypeAliases from "./rules/no-unknown-type-aliases.mjs";
import paddedIf from "./rules/padded-if.mjs";

export default {
  meta: { name: "repo" },
  rules: {
    "no-array-filter-map": noArrayFilterMap,
    "no-barrel-file": noBarrelFile,
    "no-chained-type-assertions": noChainedTypeAssertions,
    "no-conditional-spread": noConditionalSpread,
    "no-module-mocking": noModuleMocking,
    "no-native-primitives": noNativePrimitives,
    "no-reduce-accumulator-copy": noReduceAccumulatorCopy,
    "no-reflect-apply": noReflectApply,
    "no-reflect-get": noReflectGet,
    "no-ui-primitives-outside-ui": noUiPrimitivesOutsideUi,
    "no-unknown-type-aliases": noUnknownTypeAliases,
    "padded-if": paddedIf,
  },
};
