# Aven environment

`.aven/setup` checks Node.js 24+, uses the pnpm version in `package.json`, keeps the pnpm store outside the repository, installs frozen workspace dependencies and local PostgreSQL/Redis servers, and copies `.env.example` only if `.env` is missing. Aven runs it when creating the environment snapshot; it does not start services or run migrations.

`.aven/resume` starts user-owned PostgreSQL and Redis when each thread starts, on ports **15432** and **16379** to match `.env.example`. They listen only on loopback, without Docker or sudo. PostgreSQL uses trust authentication for this disposable local database only; do not use this configuration in production. Server state and logs live under `~/.local/share/monorepo-template`, outside the repository.

Before starting the API, add a unique `BETTER_AUTH_SECRET` of at least 32 characters to this repository's environment variables in Aven. Do not commit secrets or put them in setup scripts. The example deliberately leaves this value empty; checks, tests, and builds do not need it.

Before working with the running applications, apply migrations with `pnpm db:migrate`, then use `pnpm dev`. Run migrations again after a container is recreated: the snapshot does not preserve a thread's database rows. API integration tests use PGlite and do not need the local servers.

Validation commands match CI:

```sh
pnpm --filter @repo/db exec drizzle-kit check
pnpm check
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @repo/web exec wrangler deploy --dry-run
```

## Shipping

`.aven/ship.md` configures the Ship button to keep the thread branch, rebase onto `main`, run all CI-equivalent checks, and open or update a **draft** PR. Merging stays manual; Ship does not deploy production or enable auto-merge. Every UI change requires screenshots and a flow recording, committed under `.aven/proof/` and retained for merging. Capture uses the desktop browser and `ffmpeg`; Playwright is not installed.

Ship reads the file directly from the current workspace, so it works in this thread immediately. Edit and commit it to change the workflow; delete it to restore Aven's default. There is no separate shipping snapshot to save.

Commit the `.aven` folder so every thread receives these instructions and Aven can rebuild the environment snapshot after 72 hours or when the setup script changes.
