const filePath = (context) => String(context.filename ?? "").replaceAll("\\", "/");

const isUiPrimitiveImport = (source) =>
  source === "radix-ui" ||
  source.startsWith("radix-ui/") ||
  source.startsWith("@radix-ui/") ||
  source === "@base-ui/react" ||
  source.startsWith("@base-ui/react/");

const noUiPrimitivesOutsideUi = {
  meta: {
    type: "suggestion",
    docs: { description: "Only @repo/ui may import headless UI primitive packages." },
    messages: {
      noUiPrimitivesOutsideUi:
        "Import UI components from @repo/ui. Only packages/ui may import radix-ui or @base-ui/react.",
    },
    schema: [],
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        const source = node.source?.value;

        if (typeof source !== "string" || !isUiPrimitiveImport(source)) return;

        if (filePath(context).includes("/packages/ui/")) return;

        context.report({ node, messageId: "noUiPrimitivesOutsideUi" });
      },
    };
  },
};

export default noUiPrimitivesOutsideUi;
