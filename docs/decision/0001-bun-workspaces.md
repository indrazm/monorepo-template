---
status: accepted
date: 2026-11-24
supersedes: []
superseded_by: null
---

# 0001: Install and run the workspace with Bun

## Context

The workspace used pnpm 10. `pnpm-workspace.yaml` declared the package globs, a shared dependency catalog, one override, and the install-script allowlist; `pnpm-lock.yaml` carried resolutions. pnpm-specific syntax reached package scripts, CI, and every guide.

The repository needs one install command for all packages, shared dependency versions, a way to run a script in selected packages, reproducible installs in CI and on deployment machines, and explicit consent for dependency install scripts.

Bun 1.4 covers those requirements: `workspaces`, a root `catalog` with the `catalog:` protocol in `dependencies`, `devDependencies`, and `peerDependencies`, `overrides` for transitive pins, `trustedDependencies` as the install-script allowlist, `bun run --filter` and `--workspaces`, and a text `bun.lock`.

## Decision

Bun is the package manager and workspace runner. Node.js stays the application runtime.

- Package globs, `catalog`, and `trustedDependencies` live in the root `package.json`; `pnpm-workspace.yaml` is removed.
- `bun.lock` replaces `pnpm-lock.yaml`. CI and the deployment role install with `--frozen-lockfile`.
- Scripts use `bun run --filter <name>` for one package and `bun run --workspaces --if-present` for all packages.
- Tools invoked per package get a package script instead of `pnpm exec`: `db:check` in `@repo/db` and `deploy:dry-run` in `@repo/web`. `bunx --cwd apps/web` covers one-off CLIs such as `wrangler login`.
- `tsx`, `vite`, `wrangler`, and `vitest` keep running on Node. Bun does not become the application runtime in this change.
- Deployment installs Node.js and Bun on the machine and runs the API and worker under systemd. See [decision 0002](0002-nix-and-single-machine-deployment.md).
- `scripts/check-boundaries.mjs` spawns the workspace `oxlint` binary directly.
- The install uses Bun's isolated linker (per-package `node_modules`, shared store under `node_modules/.bun`), pinned in `bunfig.toml`. It preserves pnpm's rule that a package can only import dependencies it declares.

The pnpm override that removed `better-auth`'s Prisma adapter is dropped. Bun `overrides` can pin a transitive dependency but cannot delete one with `"-"`. The migrated lockfile still omits the adapter because the pnpm resolution carried over; regenerating the lockfile adds it back. That package is 36 KB and does not install Prisma, because `@prisma/client` and `prisma` are optional peers.

## Alternatives

- Keep pnpm: no migration, but the repository keeps a second toolchain for the same job.
- Use Bun as the runtime too (`bun src/main.ts`, `bun --watch`, `bun test`): removes `tsx` and possibly `vitest`, but changes the production process model and every driver integration, which the package-manager switch does not require.
- `linker = "hoisted"` (Bun's npm-style layout, selectable in `bunfig.toml`): the safest for undeclared imports, but it hides phantom dependencies that the pnpm layout surfaced.

## Consequences

Benefits: one tool for installs and workspace scripts, faster installs, catalogs and workspace filters without a second config file, and a readable lockfile.

Costs and limits:

- `pnpm exec <binary>` has no direct equivalent; per-package CLIs need a script or `bunx --cwd <dir>`.
- Bun cannot remove a transitive dependency, so a lockfile regeneration re-adds `@better-auth/prisma-adapter` (36 KB); Prisma itself stays out because its peer is optional.
- Bun only runs dependency install scripts listed in `trustedDependencies`; new native dependencies must be added there.
- Bun adds ancestor `node_modules/.bin` directories to a workspace script's `PATH`, so a package can run `vitest` without declaring it. The root `devDependencies` keep the shared test, lint, and format tools; package-level declarations stay for runtime imports.
- CI uses `oven-sh/setup-bun` plus `actions/setup-node`, and caches `~/.bun/install/cache` by `bun.lock` hash.

Follow-up: moving the application runtime to Bun (`tsx` to `bun`, `vitest` to `bun test`) is a separate decision with its own verification.

## Status history

| Date       | Status   | Reason            |
| ---------- | -------- | ----------------- |
| 2026-11-24 | accepted | Initial decision. |
