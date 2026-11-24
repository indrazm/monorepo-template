import { unwrap } from "../shared/unwrap.mjs";

const isConst = (node) =>
  node.typeAnnotation.type === "TSTypeReference" &&
  node.typeAnnotation.typeName.type === "Identifier" &&
  node.typeAnnotation.typeName.name === "const";

const isAssertion = (node) => node.type === "TSAsExpression" || node.type === "TSTypeAssertion";

const noChainedTypeAssertions = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow an assertion applied to another assertion (`x as unknown as T`).",
    },
    messages: {
      noChainedTypeAssertion:
        "Do not chain type assertions. Narrow with a type guard, a typed helper or a single assertion.",
    },
    schema: [],
  },
  create(context) {
    const check = (node) => {
      if (node.type === "TSAsExpression" && isConst(node)) return;

      const inner = unwrap(node.expression);

      if (isAssertion(inner) && !(inner.type === "TSAsExpression" && isConst(inner))) {
        context.report({ node, messageId: "noChainedTypeAssertion" });
      }
    };
    return { TSAsExpression: check, TSTypeAssertion: check };
  },
};

export default noChainedTypeAssertions;
