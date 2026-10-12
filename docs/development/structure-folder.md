# Struktur Folder

Monorepo `pnpm-workspace`: `apps/*` + `packages/*`. Aturan import dijaga `scripts/check-boundaries.mjs`.

```
tacto-app/
├── apps/                  # runnable services
│   ├── api/               # Backend Hono + Better-Auth
│   ├── web/               # Frontend React + Vite + TanStack Router, deploy Cloudflare
│   └── worker/            # Background job BullMQ
├── packages/              # shared libraries (diimport via @repo/*)
│   ├── contracts/         # Zod schema + tipe API & job (single source of truth)
│   ├── config/            # Loader env runtime + database
│   ├── db/                # Drizzle schema, koneksi Postgres, migrasi
│   ├── api-client/        # Hono client typed dari AppType
│   ├── queue/             # Factory BullMQ Queue/Events
│   ├── storage/           # Wrapper S3 (put/get/delete + signed URL)
│   └── ui/                # Design system shadcn-style (components/hooks/lib)
├── scripts/               # check-boundaries.mjs, check-env.ts
├── docs/                  # backend, frontend, database, worker, storage, contracts, deployment, development/
├── docker-compose.yaml / docker-compose.dev.yaml
├── Dockerfile
├── package.json           # script root: dev, build, typecheck, lint, db:*, check
├── pnpm-workspace.yaml    # definisi workspace + catalog versi
└── tsconfig.base.json
```

## apps/api — `@repo/api`

`src/main.ts` entrypoint, `src/server.ts` bootstrap, `src/app.ts` factory Hono, `src/config.ts` env.

- `src/modules/auth/` → `auth.ts` setup Better-Auth, `middleware.ts` load session.
- `src/modules/users/` + `src/modules/profile/` → `router.ts` (HTTP), `services.ts` (bisnis + db).
- `scripts/createsuperuser.ts` → CLI buat admin.

## apps/web — `@repo/web`

Vite + React 19, TanStack Router + Query.

- `src/main.tsx`, `src/styles.css`, `src/config.ts` env client, `src/api.ts` instance api-client.
- `src/routes/` → `__root.tsx`, `index.tsx`, `login.tsx`, `register.tsx`, `profile.tsx`. `routeTree.gen.ts` auto-generate, jangan edit manual.
- `src/features/` per fitur: `auth/` (services, types, query-keys, hooks/use-auth), `profile/` (services, hooks/use-profile, components/profile-page), `app-shell/` (layout).
- `public/_headers`, `wrangler.jsonc` → deploy Cloudflare.

## apps/worker — `@repo/worker`

- `src/main.ts` entry, `src/worker.ts` koneksi + registrasi processor, `src/config.ts` env.
- `src/processors/example.ts` (+ `.test.ts`) → template processor per queue.

## packages/

- `contracts/src/`: `users.ts`, `profile.ts`, `errors.ts`, `jobs.ts` → dipakai api, web, worker agar tipe sinkron.
- `config/src/`: `runtime.ts` (env API/worker/web), `database.ts` (connection string).
- `db/src/`: `schema.ts` tabel, `index.ts` `createDatabase()`. `drizzle/` SQL + snapshot, `drizzle.config.ts`.
- `api-client/src/index.ts`: `createApiClient()`, `fetchSessionUser()`, `updateCurrentUserProfile()`.
- `queue/src/index.ts`: `createQueueConnection()`, `createExampleQueue()`, `createExampleQueueEvents()`.
- `storage/src/`: `types.ts` (StorageConfig), `index.ts` `createStorage()` S3-compatible.
- `ui/src/`: `components/*.tsx` (~50 komponen), `hooks/use-mobile.ts`, `lib/utils.ts`, `styles.css`.

## Lainnya

- `scripts/check-env.ts` → validasi `.env` vs `config`. `check-boundaries.mjs` → larang import relatif antar-package & import server dari browser.
- `docs/development/` → `prd.md`, `srs.md`, `style-guide.md`, `structure-folder.md`, `implementation/`.
- Root config: `.env` (lokal, gitignore), `.env.example` (acuan), `Dockerfile`, `docker-compose*.yaml`.
