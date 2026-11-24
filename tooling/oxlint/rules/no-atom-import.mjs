const filePath = (context) => String(context.filename ?? "").replaceAll("\\", "/");

const layerThatReadsHooks = (file) =>
  file.includes("/apps/web/") &&
  (file.includes("/routes/") || (file.includes("/features/") && file.includes("/components/")));

const noAtomImport = {
  meta: {
    type: "suggestion",
    docs: { description: "Routes and feature components read atoms through hooks." },
    messages: {
      noAtomImport: "Routes and feature components do not import atoms. Call the module's hook.",
    },
    schema: [],
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        const source = node.source?.value;

        if (typeof source !== "string") return;

        if (!layerThatReadsHooks(filePath(context))) return;

        if (!source.includes("/atoms/") && !source.endsWith("/atoms")) return;

        context.report({ node, messageId: "noAtomImport" });
      },
    };
  },
};

export default noAtomImport;
