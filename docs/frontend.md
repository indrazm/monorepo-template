# Frontend

The React application lives in `apps/web`. Use `bun run --filter @repo/web dev` to run it.

## Rules

- Route files in `src/routes` own routing, access redirects, and feature composition. Keep substantial feature UI in `src/features/<feature>`.
- Keep feature services, hooks, and components together. Authentication owns session queries; profile owns profile mutations.
- Use TanStack Query for server state and local React state for form drafts and presentation state.
- Keep cache keys in `query-keys.ts`. Refresh affected queries after mutations; do not insert a different response representation into an existing cache entry.
- Use the clients configured in `src/api.ts`: Better Auth for auth operations and `@repo/api-client` for custom API operations.
- Infer request and response types. Reuse shared request schemas for form validation; do not duplicate their rules or cast responses to handwritten interfaces.
- Use `@repo/ui` for reusable visual primitives. Keep product-specific components in the application.
- Use plain English UI text. The template includes a theme selector and no translation infrastructure.
- Treat `VITE_*` values as public. Validate them in `src/config.ts`; keep credentials on the server.
- Never edit `src/routeTree.gen.ts` manually; the router plugin generates it.

## Adding a feature

1. Add its API operation to the typed client if needed.
2. Create feature services and query/mutation hooks.
3. Build the feature UI with local form state and shared validation.
4. Compose it from a route and add access checks where required.
5. Verify loading, failure, empty, and successful states, plus cache updates.

Run `bun run --filter @repo/web typecheck` and `bun run --filter @repo/web build` after changing routes or shared UI. See [contract rules](contracts.md).
