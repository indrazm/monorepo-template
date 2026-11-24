const noUnknownTypeAliases = {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow `type X = unknown`." },
    messages: {
      noUnknownTypeAlias: "`{{name}}` only renames `unknown`. Use `unknown` or a real type.",
    },
    schema: [],
  },
  create(context) {
    return {
      TSTypeAliasDeclaration(node) {
        if (node.typeAnnotation.type === "TSUnknownKeyword") {
          context.report({ node, messageId: "noUnknownTypeAlias", data: { name: node.id.name } });
        }
      },
    };
  },
};

export default noUnknownTypeAliases;
