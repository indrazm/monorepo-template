# Working with this repository

Start with the [root README](../README.md) for setup and common commands. These guides describe where changes belong and the rules to follow.

- [Backend](backend.md): API modules, authentication, and runtime dependencies.
- [Frontend](frontend.md): routes, features, API calls, and UI state.
- [Database](database.md): persistence schemas, migrations, and integration tests.
- [Contracts](contracts.md): shared schemas and public boundaries.
- [Worker](worker.md): queue producers, processors, and job lifecycle.
- [Storage](storage.md): object storage configuration and ownership.
- [Deployment](deployment.md): Nix services, Terraform and Ansible for one machine, runtime configuration, and Cloudflare publishing.
- [Decisions](decision/README.md): recording and replacing architectural decisions.

## Common rules

- Applications own configuration, resource creation, and shutdown. Shared packages accept dependencies explicitly.
- Import workspace packages through public exports and declare each dependency in the consumer's `package.json`. Register new packages in `packageRuntimes` in `scripts/check-boundaries.mjs`.
- Keep browser code free of server infrastructure. The API client may import `@repo/api/types` using `import type` for RPC inference.
- Shared contracts and configuration primitives must not depend on other workspace packages.
- Keep feature logic with its feature. Extract a shared package when there is a concrete reuse requirement.
- Name files for their contents: `schema.ts` for schemas, `query-keys.ts` for cache keys, and focused names instead of `utils.ts`.
- Keep startup and failure messages simple. Never print secrets, credentials, or session tokens.
- Record architectural choices with lasting tradeoffs in a decision file. Routine implementation details do not need one.
- Repository lint rules live in `tooling/oxlint/rules` and are registered in `.oxlintrc.json`. Add a test beside each rule; `bun run test:rules` runs them.

## Change workflow

1. Read the relevant guide and accepted decisions before editing.
2. For a feature, define its contract first, then implement the owning API or worker and its frontend consumer.
3. Add or update tests for changed behavior. Keep configuration schemas and `.env.example` aligned.
4. Run the checks below before committing. Review generated migrations and lockfile changes. `bun install` installs the hooks in `hk.pkl`, which run the staged checks on commit and the full checks on push.
5. Update documentation and decision status when the change affects established rules.

```sh
bun run check
bun run typecheck
bun run test
bun run build
```

Use `bun run format` to apply formatting. Use `bun run --filter @repo/<package> test` for a focused suite when that package has a test script. Shared packages are source-only; `build` bundles the web application.
