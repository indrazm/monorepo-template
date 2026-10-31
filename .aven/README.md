# Aven development environment

`.aven/setup` installs the pnpm version from `package.json`, locked workspace dependencies, and Debian's PostgreSQL and Redis packages. It copies `.env.example` only when `.env` is missing. Node.js 24+ is provided by the sandbox.

`.aven/resume` starts container-local PostgreSQL on `127.0.0.1:15432` and Redis on `127.0.0.1:16379`, matching `.env.example`, without Docker or sudo. These are development-only services; PostgreSQL trusts local connections. The sandbox uses Debian's PostgreSQL version, while Docker Compose uses PostgreSQL 16.

Before using the API, apply migrations in the thread:

```sh
pnpm db:migrate
```

Data lives under `~/.local/share/aven/monorepo-template`, not in the repository. It can be lost when a container is recreated, so rerun migrations as needed. A configured project `DATABASE_URL` or `REDIS_URL` takes precedence over `.env` defaults; these scripts never migrate an external database automatically.

No production credentials are needed for setup or the test suites. Supply any runtime secrets through Aven's project environment variables, never through these scripts.

Commit the `.aven` folder to keep setup reproducible. Aven rebuilds the snapshot after 72 hours and when the setup script changes.
