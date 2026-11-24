const NATIVE_PRIMITIVES = new Set([
  "button",
  "input",
  "select",
  "textarea",
  "label",
  "form",
  "fieldset",
  "dialog",
  "progress",
  "meter",
]);

const noNativePrimitives = {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow native form/interactive elements; use @repo/ui components." },
    messages: {
      noNativePrimitive:
        "Do not use native <{{name}}>. Use the corresponding component from @repo/ui/components.",
    },
    schema: [],
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        const name = node.name.type === "JSXIdentifier" ? node.name.name : null;

        if (name && NATIVE_PRIMITIVES.has(name)) {
          context.report({ node, messageId: "noNativePrimitive", data: { name } });
        }
      },
    };
  },
};

export default noNativePrimitives;
