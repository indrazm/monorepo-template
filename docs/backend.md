# Backend

ngrok http 8000 --url https://celena-draughtiest-marylee.ngrok-free.dev

The Hono API lives in `apps/api`. Use `pnpm --filter @repo/api dev` to run it.

## Rules

- Put feature routers and services in `src/modules/<feature>`.
- Routers own HTTP validation, authorization, status codes, and error mapping. Services own feature operations and database queries.
- Define public schemas in `@repo/contracts`; pass validated, normalized input to services.
- Inject the database and other dependencies through factories. Do not import a global database or read environment variables inside a feature service.
- Select response fields explicitly. Serialize database dates to ISO strings and preserve the contract's nullability.
- Use `apiError` from `@repo/contracts/errors` for defined API error codes. Map expected service errors to an appropriate HTTP response.
- Use Better Auth for authentication and session types. Load sessions only on routes that need them, and enforce permissions before protected operations.
- Keep `/health` independent of session lookup and database access.

## Adding a feature

1. Add its request and response schemas to `packages/contracts/src/<feature>.ts`.
2. Implement a service accepting only the dependencies it uses.
3. Add a router with request validation and authorization; mount it in `src/app.ts`.
4. Update `@repo/api-client` when consumers need a new operation.
5. Test validation, access control, expected errors, and successful behavior.

`src/main.ts` parses application configuration. `src/server.ts` creates resources, starts the server, and closes the database pool during shutdown. Add environment fields in `src/config.ts` and `.env.example`.

API routing tests supply dependencies directly. Database/auth integration tests use PGlite and committed migrations. See [database rules](database.md) and [contract rules](contracts.md).
