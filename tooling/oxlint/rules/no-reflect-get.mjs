import { callOnGlobal } from "../shared/ast.mjs";

const noReflectGet = {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow `Reflect.get(...)`." },
    messages: {
      noReflectGet: "Do not use Reflect.get. Read the property with typed access, `target[key]`.",
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        if (callOnGlobal(context, node, "Reflect", "get")) {
          context.report({ node, messageId: "noReflectGet" });
        }
      },
    };
  },
};

export default noReflectGet;
