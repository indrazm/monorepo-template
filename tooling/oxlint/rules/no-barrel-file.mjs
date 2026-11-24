const isReExport = (node) =>
  (node.type === "ExportAllDeclaration" || node.type === "ExportNamedDeclaration") &&
  node.source != null;

const noBarrelFile = {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow barrel files that only re-export from other modules." },
    messages: { noBarrelFile: "Barrel files are not allowed. Import from the exact file." },
    schema: [],
  },
  create(context) {
    return {
      Program(node) {
        if (node.body.length > 0 && node.body.every(isReExport)) {
          context.report({ node, messageId: "noBarrelFile" });
        }
      },
    };
  },
};

export default noBarrelFile;
