import { unwrap } from "./unwrap.mjs";

export const peel = (node) => {
  const inner = unwrap(node);

  return inner.type === "ChainExpression" ? peel(inner.expression) : inner;
};

export const propertyName = (member) => {
  if (member.type !== "MemberExpression" || member.computed) return null;

  return member.property.type === "Identifier" ? member.property.name : null;
};

export const isGlobalName = (context, node, name) => {
  if (node.type !== "Identifier" || node.name !== name) return false;

  let scope = context.sourceCode.getScope(node);

  while (scope) {
    if (scope.set?.get(name)?.defs.length > 0) return false;

    scope = scope.upper;
  }

  return true;
};

export const callOnGlobal = (context, node, objectName, methodName) => {
  const callee = unwrap(node.callee);

  return (
    callee.type === "MemberExpression" &&
    propertyName(callee) === methodName &&
    isGlobalName(context, unwrap(callee.object), objectName)
  );
};
