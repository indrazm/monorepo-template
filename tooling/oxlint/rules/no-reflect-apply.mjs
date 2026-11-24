import { callOnGlobal } from "../shared/ast.mjs";

const noReflectApply = {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow `Reflect.apply(...)`." },
    messages: {
      noReflectApply:
        "Do not use Reflect.apply. Call the function directly, or use `fn.apply(this, args)`.",
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        if (callOnGlobal(context, node, "Reflect", "apply")) {
          context.report({ node, messageId: "noReflectApply" });
        }
      },
    };
  },
};

export default noReflectApply;
