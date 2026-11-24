export const unwrap = (node) =>
  node.type === "ParenthesizedExpression" ? unwrap(node.expression) : node;
