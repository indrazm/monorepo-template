const DIRECTIVE =
  /^\/?\s*(@ts-(expect-error|ignore|nocheck|check)\b|<reference\s|oxlint-|eslint-|oxfmt-ignore|prettier-ignore|@vite-ignore)/;

const noComments = {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow comments. Tool directives stay." },
    messages: {
      noComment:
        "No comments. Names, types and tests say what code does; why goes in docs/decision/.",
    },
    schema: [],
  },
  create(context) {
    return {
      Program() {
        if (!/\.tsx?$/.test(context.filename)) {
          return;
        }

        for (const comment of context.sourceCode.getAllComments()) {
          if (comment.type !== "Shebang" && !DIRECTIVE.test(comment.value)) {
            context.report({ loc: comment.loc, messageId: "noComment" });
          }
        }
      },
    };
  },
};

export default noComments;
