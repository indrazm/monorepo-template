import { callOnGlobal, peel, propertyName } from "../shared/ast.mjs";

const REDUCERS = new Set(["reduce", "reduceRight"]);
const COPYING_METHODS = new Set(["concat", "slice"]);

const isFunction = (node) =>
  node.type === "ArrowFunctionExpression" || node.type === "FunctionExpression";

const isAccumulator = (node, name) => {
  const inner = peel(node);

  return inner.type === "Identifier" && inner.name === name;
};

const noReduceAccumulatorCopy = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow returning a fresh copy of the accumulator from a reduce callback.",
    },
    messages: {
      noReduceAccumulatorCopy:
        "Do not copy the accumulator on every step. Mutate it and return it, or use a loop.",
    },
    schema: [],
  },
  create(context) {
    const callbacks = new Map();

    const copiesAccumulator = (expression, name) => {
      const node = peel(expression);

      if (node.type === "ConditionalExpression") {
        return copiesAccumulator(node.consequent, name) || copiesAccumulator(node.alternate, name);
      }

      if (node.type === "LogicalExpression") {
        return copiesAccumulator(node.left, name) || copiesAccumulator(node.right, name);
      }

      if (node.type === "SequenceExpression") {
        return copiesAccumulator(node.expressions.at(-1), name);
      }

      if (node.type !== "CallExpression") return false;

      const callee = peel(node.callee);

      if (callOnGlobal(context, node, "Object", "assign")) {
        const [target, ...sources] = node.arguments;

        return (
          target?.type === "ObjectExpression" &&
          sources.some((source) => isAccumulator(source, name))
        );
      }

      const method = propertyName(callee);

      return method !== null && COPYING_METHODS.has(method) && isAccumulator(callee.object, name);
    };

    const checkReturned = (callback, expression) => {
      const name = callbacks.get(callback);

      if (name && expression && copiesAccumulator(expression, name)) {
        context.report({ node: expression, messageId: "noReduceAccumulatorCopy" });
      }
    };

    const enclosingFunction = (node) => {
      let current = node.parent;

      while (current && !isFunction(current)) current = current.parent;

      return current;
    };

    return {
      CallExpression(node) {
        const callee = peel(node.callee);
        const method = propertyName(callee);
        const [callback] = node.arguments;

        if (!method || !REDUCERS.has(method) || !callback || !isFunction(callback)) return;

        const [accumulator] = callback.params;

        if (accumulator?.type === "Identifier") callbacks.set(callback, accumulator.name);
      },
      ArrowFunctionExpression(node) {
        if (node.expression) checkReturned(node, node.body);
      },
      ReturnStatement(node) {
        const callback = enclosingFunction(node);

        if (callback) checkReturned(callback, node.argument);
      },
    };
  },
};

export default noReduceAccumulatorCopy;
