import noArrayFilterMap from "./rules/no-array-filter-map.mjs";
import noChainedTypeAssertions from "./rules/no-chained-type-assertions.mjs";
import noModuleMocking from "./rules/no-module-mocking.mjs";
import noReduceAccumulatorCopy from "./rules/no-reduce-accumulator-copy.mjs";
import noReflectApply from "./rules/no-reflect-apply.mjs";
import noReflectGet from "./rules/no-reflect-get.mjs";
import noUnknownTypeAliases from "./rules/no-unknown-type-aliases.mjs";
import noAtomImport from "./rules/no-atom-import.mjs";
import noBarrelFile from "./rules/no-barrel-file.mjs";
import noBaseUiOutsideUi from "./rules/no-base-ui-outside-ui.mjs";
import noComments from "./rules/no-comments.mjs";
import noConditionalSpread from "./rules/no-conditional-spread.mjs";
import noNativePrimitives from "./rules/no-native-primitives.mjs";
import paddedIf from "./rules/padded-if.mjs";

export default {
  meta: { name: "repo" },
  rules: {
    "no-comments": noComments,
    "no-conditional-spread": noConditionalSpread,
    "no-atom-import": noAtomImport,
    "no-barrel-file": noBarrelFile,
    "no-base-ui-outside-ui": noBaseUiOutsideUi,
    "no-native-primitives": noNativePrimitives,
    "no-array-filter-map": noArrayFilterMap,
    "no-chained-type-assertions": noChainedTypeAssertions,
    "no-module-mocking": noModuleMocking,
    "no-reduce-accumulator-copy": noReduceAccumulatorCopy,
    "no-reflect-apply": noReflectApply,
    "no-reflect-get": noReflectGet,
    "no-unknown-type-aliases": noUnknownTypeAliases,
    "padded-if": paddedIf,
  },
};
