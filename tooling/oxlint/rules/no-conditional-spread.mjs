import { unwrap } from "../shared/unwrap.mjs";

const isConditional = (node) =>
  node.type === "ConditionalExpression" ||
  (node.type === "LogicalExpression" && ["&&", "||", "??"].includes(node.operator));

const noConditionalSpread = {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow conditional spreads like `...(cond && { a })`." },
    messages: {
      noConditionalSpread:
        "Avoid conditional spread. Build the object explicitly or assign the property in an `if`.",
    },
    schema: [],
  },
  create(context) {
    const check = (node) => {
      if (isConditional(unwrap(node.argument))) {
        context.report({ node, messageId: "noConditionalSpread" });
      }
    };
    return { SpreadElement: check, JSXSpreadAttribute: check };
  },
};

export default noConditionalSpread;
