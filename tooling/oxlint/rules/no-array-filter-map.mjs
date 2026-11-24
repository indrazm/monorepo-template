import { peel, propertyName } from "../shared/ast.mjs";

const PAIRS = new Map([
  ["map", "filter"],
  ["filter", "map"],
]);

const noArrayFilterMap = {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow `.filter(...).map(...)` and `.map(...).filter(...)` chains." },
    messages: {
      noArrayFilterMap:
        "Do not chain `.{{inner}}` into `.{{outer}}`. It walks the array twice: use `flatMap` or a single loop.",
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = peel(node.callee);
        const outer = propertyName(callee);

        if (!outer || !PAIRS.has(outer)) return;

        const receiver = peel(callee.object);

        if (receiver.type !== "CallExpression") return;

        const inner = propertyName(peel(receiver.callee));

        if (inner === PAIRS.get(outer)) {
          context.report({ node, messageId: "noArrayFilterMap", data: { inner, outer } });
        }
      },
    };
  },
};

export default noArrayFilterMap;
