const PADDED_IF_PARENTS = new Set([
  "Program",
  "BlockStatement",
  "StaticBlock",
  "SwitchCase",
  "TSModuleBlock",
]);

const isBlank = (line) => line === undefined || line.trim() === "";
const opensBlock = (line) => line.trimEnd().endsWith("{");
const closesBlock = (line) => line.trimStart().startsWith("}");
const isCaseLabel = (line) => /^(case\b.*|default)\s*:$/.test(line.trim());

const paddedIf = {
  meta: {
    type: "layout",
    docs: { description: "Require a blank line above and below each `if` statement." },
    fixable: "whitespace",
    messages: {
      padBefore: "Put a blank line before this `if`.",
      padAfter: "Put a blank line after this `if`.",
    },
    schema: [],
  },
  create(context) {
    const pad = (node, messageId, index) =>
      context.report({
        node,
        messageId,
        fix: (fixer) => fixer.insertTextBeforeRange([index, index], "\n"),
      });
    return {
      IfStatement(node) {
        if (!PADDED_IF_PARENTS.has(node.parent.type)) return;

        const { lines } = context.sourceCode;
        const startLine = node.loc.start.line;
        const endLine = node.loc.end.line;

        if (startLine > 1) {
          const previous = lines[startLine - 2];

          if (!isBlank(previous) && !opensBlock(previous) && !isCaseLabel(previous)) {
            pad(
              node,
              "padBefore",
              context.sourceCode.getIndexFromLoc({ line: startLine, column: 0 }),
            );
          }
        }

        if (endLine < lines.length) {
          const next = lines[endLine];

          if (!isBlank(next) && !closesBlock(next) && !isCaseLabel(next)) {
            pad(
              node,
              "padAfter",
              context.sourceCode.getIndexFromLoc({ line: endLine + 1, column: 0 }),
            );
          }
        }
      },
    };
  },
};

export default paddedIf;
