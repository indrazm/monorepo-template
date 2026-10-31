# Aven environment

`.aven/setup` installs dependencies and creates the reusable environment snapshot.
`.aven/resume` starts local services as the unprivileged thread user; it does not
install packages or run migrations.

| Tool or service | Version | Repository source                                |
| --------------- | ------- | ------------------------------------------------ |
| Node.js         | 24      | `.github/workflows/ci-cd.yml`, `Dockerfile`      |
| pnpm            | 10.30.3 | `package.json`                                   |
| PostgreSQL      | 16      | `docker-compose.dev.yaml`, `docker-compose.yaml` |
| Redis           | 7       | `docker-compose.dev.yaml`                        |

PostgreSQL and Redis come from their vendor apt repositories, rather than Debian's
potentially different major versions. pnpm installs from the frozen lockfile and
keeps its store under the user's home directory.

## Working in a new thread

The resume hook uses the development Compose settings: PostgreSQL on port 15432
with the local-only `postgres` user/password and `monorepo_template` database,
and Redis on port 16379 with append-only persistence. Both listen on loopback.
The root `.env` is copied from `.env.example` only when missing; existing project
environment variables are not overwritten.

Before starting the API, supply `BETTER_AUTH_SECRET` (at least 32 characters) as
an Aven project environment variable. Do not commit it. Apply migrations in the
thread when needed:

```sh
pnpm db:migrate
pnpm dev
```

Service data and logs live under
`$HOME/.local/share/aven/monorepo-template`, not in the repository. Data may be
lost when a thread container is recreated; reapply migrations then. To check
service startup in a new thread (and verify the hook is safe to repeat):

```sh
.aven/resume
/usr/lib/postgresql/16/bin/psql -h /tmp -p 15432 -U postgres -d monorepo_template -c 'SELECT version();'
redis-cli -p 16379 ping
redis-cli -p 16379 INFO server | grep '^redis_version:'
```

Commit the `.aven` folder: the snapshot is rebuilt from `.aven/setup` after
72 hours and when the script changes. Environment setup does not commit, push,
or deploy anything.

## Shipping

[`.aven/ship.md`](ship.md) configures the Ship button: keep the thread branch,
validate all CI checks locally, commit screenshots for UI changes under
`.aven/proof/`, and open a draft PR against `main`. Review and merging remain
manual; Ship does not enable auto-merge or deploy.

The file takes effect immediately in this thread. Commit it to share the policy
with new threads. Edit and commit it to change the workflow; delete it to restore
Aven's default shipping behavior. No environment snapshot refresh is needed for
shipping-policy changes.
