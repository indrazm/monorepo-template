import { propertyName } from "../shared/ast.mjs";
import { unwrap } from "../shared/unwrap.mjs";

const MOCKERS = new Map([
  ["mock", new Set(["module"])],
  ["jest", new Set(["mock", "doMock", "unstable_mockModule"])],
  ["vi", new Set(["mock", "doMock"])],
]);

const noModuleMocking = {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow mocking modules (`mock.module`, `jest.mock`, `vi.mock`)." },
    messages: {
      noModuleMocking:
        "Do not mock modules. Inject the dependency or use a real one, as module mocks leak between tests.",
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = unwrap(node.callee);

        if (callee.type !== "MemberExpression") return;

        const object = unwrap(callee.object);
        const methods = object.type === "Identifier" ? MOCKERS.get(object.name) : undefined;
        const method = propertyName(callee);

        if (methods && method && methods.has(method)) {
          context.report({ node, messageId: "noModuleMocking" });
        }
      },
    };
  },
};

export default noModuleMocking;
