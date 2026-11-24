# Monorepo Template

A source-only Bun workspace with a Hono API, React web app, and BullMQ worker.

```text
apps/       api, web, worker
packages/   contracts, api-client, config, db, queue, storage, ui
infra/      Terraform and Ansible single-machine deployment
tooling/    custom oxlint rules, local services, and their tests
docs/       working guides and decision records
```

Requires Nix with flakes enabled. `nix develop` provides Bun 1.4, Node.js 24, PostgreSQL, and Redis. Bun installs and runs the workspace; application scripts run on Node.

## Quick start

```sh
nix run .#dev-infra
nix develop
bun install
cp .env.example .env
bun run db:migrate
bun run dev
```

`bun run dev` starts all three applications. Open the web app at `http://localhost:3000`; the API health endpoint is `http://localhost:8000/health`. Development PostgreSQL and Redis use ports `15432` and `16379`, with data in `.dev/`; stop them with `nix run .#dev-infra -- down`.

To run one application, use `bun run --filter @repo/api dev`, `bun run --filter @repo/web dev`, or `bun run --filter @repo/worker dev`.

## Common commands

| Command                   | Purpose                                                          |
| ------------------------- | ---------------------------------------------------------------- |
| `bun run check`           | Check package boundaries, environment docs, lint, and formatting |
| `bun run typecheck`       | Check all workspace types                                        |
| `bun run test`            | Run package and lint-rule test suites                            |
| `bun run build`           | Build the web app                                                |
| `bun run format`          | Apply formatting                                                 |
| `bun run db:generate`     | Generate a database migration                                    |
| `bun run db:migrate`      | Apply committed migrations                                       |
| `bun run createsuperuser` | Create or promote an admin user                                  |
| `nix run .#dev-infra`     | Start development PostgreSQL and Redis                           |
| `hk check`                | Run every Git hook step without committing                       |

## Git hooks

`bun install` installs the [hk](https://hk.jdx.dev) hooks declared in `hk.pkl`. A commit formats, lints, and Terraform-formats the staged files and stages the fixes. A push runs `bun run check`, `bun run typecheck`, and `bun run test`.

```sh
hk check           # every hook step, now
hk run pre-commit  # only the staged checks
hk install         # reinstall after changing hk.pkl
```

## Working guides

Start with [repository rules](docs/README.md), then read the guide for your change:

- [Backend](docs/backend.md)
- [Frontend](docs/frontend.md)
- [Database](docs/database.md)
- [Contracts](docs/contracts.md)
- [Worker](docs/worker.md)
- [Storage](docs/storage.md)
- [Deployment](docs/deployment.md)

Deployment targets one machine per environment; [infra/README.md](infra/README.md) covers provisioning and release.

Record architectural choices in [decision records](docs/decision/README.md) using the [template](docs/decision/0000-template.md).
