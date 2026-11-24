const filePath = (context) => String(context.filename ?? "").replaceAll("\\", "/");

const noBaseUiOutsideUi = {
  meta: {
    type: "suggestion",
    docs: { description: "Only @repo/ui may import @base-ui/react." },
    messages: {
      noBaseUiOutsideUi:
        "Import Base UI from @repo/ui. Only packages/ui may import @base-ui/react.",
    },
    schema: [],
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        const source = node.source?.value;

        if (typeof source !== "string" || !source.startsWith("@base-ui/react")) return;

        if (filePath(context).includes("/packages/ui/")) return;

        context.report({ node, messageId: "noBaseUiOutsideUi" });
      },
    };
  },
};

export default noBaseUiOutsideUi;
