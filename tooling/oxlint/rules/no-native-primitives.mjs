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
    docs: { description: "Disallow native form/interactive elements; use Base UI primitives." },
    messages: {
      noNativePrimitive:
        "Do not use native <{{name}}>. Use the Base UI based component from src/components.",
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
