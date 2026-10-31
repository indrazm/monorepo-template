# Aven environment

`.aven/setup` installs locked workspace dependencies and the local service tools.
It runs in the privileged setup container and leaves no services running.

| Tool       | Version | Repository source                                                 |
| ---------- | ------- | ----------------------------------------------------------------- |
| Node.js    | 24.x    | `.github/workflows/ci-cd.yml`, `Dockerfile` (README requires 24+) |
| pnpm       | 10.30.3 | `package.json#packageManager`                                     |
| PostgreSQL | 16.x    | `docker-compose.dev.yaml`, `docker-compose.yaml`                  |
| Redis      | 7.x     | `docker-compose.dev.yaml`                                         |

PostgreSQL and Redis come from their vendor apt repositories, not Debian's
potentially different major versions. Native processes replace Docker here.

`.aven/resume` starts user-owned PostgreSQL and Redis at each thread start,
with the development compose settings: database `monorepo_template`, the
example `postgres` user/password, ports 15432 and 16379, and Redis append-only
persistence. It copies `.env.example` only when `.env` is absent.

Data and logs live under `~/.local/share/monorepo-template`, outside git.
Data can disappear when an idle container is recreated. Before using the API,
run `pnpm db:migrate` again. Do not run development Docker services at the
same time; they would use the same ports.

Set `BETTER_AUTH_SECRET` as an Aven project environment variable before
starting the API. Never put a real secret in these scripts. Tests use PGlite
and injected configuration, so they need no project secrets or running servers.

Validation commands match CI:

```sh
pnpm --filter @repo/db exec drizzle-kit check
pnpm check
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @repo/web exec wrangler deploy --dry-run
```

Commit the `.aven` folder when shipping. New threads use the saved environment;
it is rebuilt from `.aven/setup` after 72 hours or when the script changes.
