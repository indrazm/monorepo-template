# Database

`packages/db` owns the Drizzle persistence schema, database factory, and PostgreSQL migrations.

## Rules

- Define tables and constraints in `src/schema.ts`. Import them through `@repo/db/schema`.
- Treat the persistence schema as the source of truth for stored data. Public API representations belong in `@repo/contracts`.
- Infer database record types from Drizzle when needed; do not copy table shapes into handwritten types.
- Application startup owns `createDatabase(connectionString)` and its `{ db, pool }` result. Close the pool during shutdown.
- Keep feature queries in their owning service. Add a repository layer when query reuse or complexity warrants it.
- Enforce durable invariants with database constraints. Use transactions for operations that must succeed or fail together.
- Select public fields explicitly; do not expose full database rows by default.
- Commit generated SQL migrations and schema snapshots together. Do not rewrite migrations already applied to a shared database.
- Use `db:push` only for disposable local databases; use committed migrations for databases you intend to keep.

## Changing the schema

1. Edit `packages/db/src/schema.ts`.
2. Run `bun run db:generate`.
3. Review generated SQL for data loss, defaults, constraints, indexes, and any required data migration.
4. Run `bun run db:migrate` against your development database.
5. Update and run affected integration tests; commit the schema and migration artifacts together.

```sh
bun run db:check
bun run --filter @repo/api test
bun run db:studio
```

API integration tests apply committed migrations to PGlite and inject that database into services and Better Auth. For PostgreSQL-specific behavior or migration risks, also verify against PostgreSQL. Database tooling reads the root `.env`; the shared database URL schema lives in `@repo/config/database`.
