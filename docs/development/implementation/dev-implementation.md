# Rencana Implementasi (Code-Level) — Tacto

**Development Implementation Plan — langkah coding berscope kecil**
Versi: 2.0 · Tanggal: 12 Oktober 2026 · Status: Draft
Acuan: [prd.md](../prd.md) · [srs.md](../srs.md) · [style-guide.md](../style-guide.md) · [structure-folder.md](../structure-folder.md)

---

## Cara pakai dokumen ini

Dokumen ini adalah **urutan fase kecil**. Satu fase = satu task yang bisa dikerjakan & di-commit sekali duduk (≈½–1 hari). Kerjakan berurutan; tiap fase berdiri di atas fase sebelumnya.

Format tiap fase:

> **Hasil** — apa yang jadi setelah fase ini.
> **File** — path persis yang dibuat/diubah.
> **Kerjakan** — langkah + kode konkret (ikuti pola repo).
> **Cek** — perintah/aksi untuk memverifikasi.
> **FR** — kebutuhan [srs.md](../srs.md) yang tersentuh.

### Konvensi repo yang WAJIB diikuti (dari kode eksisting)

- **Modul API:** tiap domain punya folder `apps/api/src/modules/<x>/` dengan `router.ts` (export `create<X>Router(service)`) + `services.ts` (export `create<X>Service(db)`). Di-wire di `apps/api/src/app.ts` lewat `.route()` + `.use("/path", loadSession)`.
- **Kontrak:** semua skema di `packages/contracts/src/<x>.ts`, pakai `zod`, export tipe via `z.output<...>`. Import: `@repo/contracts/<x>`.
- **Error:** balas error pakai `apiError("code")` dari `@repo/contracts/errors`; **tambahkan code baru ke enum** `apiErrorSchema` sebelum dipakai.
- **Validasi:** `zValidator("json"|"query"|"param", schema, onError)` dari `@hono/zod-validator`.
- **DB:** tabel domain baru pakai `snake_case` (sesuai SRS §5) di `packages/db/src/schema.ts`; id `cuid2`. Jangan `db:push` ke prod — selalu `db:generate` → review SQL → `db:deploy`.
- **RPC:** web memanggil API hanya via `@repo/api-client` (`hc<AppType>`). `AppType` diekspor `apps/api` (`@repo/api/types`).
- **Batas modul:** browser (`web`, `ui`, `contracts`, `api-client`, `widget`) **tak boleh** import `db`/`queue`/`storage`/`config`. Dijaga `pnpm check:boundaries`.
- **Tenant:** tiap query domain difilter `organizationId`/`siteId`.
- **Gate selesai:** `pnpm check && pnpm typecheck` hijau + test terkait lulus.

### Indeks fase

| #       | Epik                        | Fase    |
| ------- | --------------------------- | ------- |
| EPIK A  | Fondasi                     | F1–F12  |
| EPIK B  | Auth & Org multi-tenant     | F13–F16 |
| EPIK C  | Site & Pixel                | F17–F21 |
| EPIK D  | Widget runtime (`t.js`)     | F22–F28 |
| EPIK E  | Mesin notifikasi            | F29–F38 |
| EPIK F  | Ingestion event             | F39–F44 |
| EPIK G  | Mesin testimonial           | F45–F52 |
| EPIK H  | Studio (aset)               | F53–F57 |
| EPIK I  | Analytics                   | F58–F61 |
| EPIK J  | Billing freemium            | F62–F65 |
| EPIK K  | Onboarding & Acceptance MVP | F66–F69 |
| EPIK L+ | Fase 2–4 (ringkas)          | F70+    |

---

# EPIK A — Fondasi

## Fase 1 — Rename identitas repo

> **Hasil:** repo bernama `tacto`, bukan `monorepo-template`.
> **File:** `package.json` (root), `apps/api/src/modules/auth/auth.ts`, `README.md`.
> **Kerjakan:**
>
> 1. `package.json` root: `"name": "tacto"`.
> 2. `auth.ts`: `appName: "Tacto"`.
> 3. `README.md`: ganti judul & deskripsi 1 paragraf.
>    **Cek:** `pnpm install` bersih; `git grep -n "monorepo-template"` kosong (kecuali lockfile).

## Fase 2 — Env matrix di `.env.example`

> **Hasil:** semua env Tacto tercatat.
> **File:** `.env.example`.
> **Kerjakan:** tambahkan:
>
> ```sh
> DATABASE_URL=postgresql://tacto:tacto@localhost:5432/tacto
> REDIS_URL=redis://localhost:6379
> BETTER_AUTH_SECRET=change-me
> BETTER_AUTH_URL=http://localhost:3000
> CLIENT_ORIGINS=http://localhost:5173
> API_URL=http://localhost:3000
> WIDGET_CDN_URL=http://localhost:8080
> # Fase 2+
> STRIPE_SECRET_KEY=
> STRIPE_WEBHOOK_SECRET=
> GOOGLE_CLIENT_ID=
> GOOGLE_CLIENT_SECRET=
> S3_ENDPOINT=
> S3_BUCKET=
> S3_ACCESS_KEY_ID=
> S3_SECRET_ACCESS_KEY=
> ```
>
> **Cek:** `cp .env.example .env` lalu isi lokal.

## Fase 3 — Config runtime: Redis + widget origins

> **Hasil:** `@repo/config` memvalidasi env baru.
> **File:** `packages/config/src/runtime.ts`, `scripts/check-env.ts`.
> **Kerjakan:** tambah field skema untuk `REDIS_URL`, `WIDGET_CDN_URL`, `API_URL`; pecah subset `api` (butuh DB+Redis), `worker` (butuh DB+Redis), `web` (hanya `API_URL`/publik).
> **Cek:** `pnpm check:env` gagal bila `REDIS_URL` dihapus, lulus saat lengkap.

## Fase 4 — Enum Drizzle domain

> **Hasil:** semua enum domain ada di schema.
> **File:** `packages/db/src/schema.ts`.
> **Kerjakan:** tambah di bawah import:
>
> ```ts
> import { pgEnum } from "drizzle-orm/pg-core";
> export const planEnum = pgEnum("plan", ["free", "starter", "growth", "agency"]);
> export const notificationTypeEnum = pgEnum("notification_type", [
>   "recent_sales",
>   "counter",
>   "live_visitors",
>   "review",
>   "custom",
>   "combo",
>   "social_counter",
>   "youtube",
>   "low_stock",
>   "countdown",
> ]);
> export const eventTypeEnum = pgEnum("event_type", [
>   "purchase",
>   "signup",
>   "visit",
>   "form_submit",
>   "custom",
> ]);
> export const formPageKindEnum = pgEnum("form_page_kind", [
>   "rating",
>   "negative_feedback",
>   "welcome",
>   "question",
>   "consent",
>   "about_you",
>   "about_company",
>   "thank_you",
> ]);
> export const testimonialStatusEnum = pgEnum("testimonial_status", [
>   "pending",
>   "approved",
>   "rejected",
>   "hidden",
> ]);
> export const assetKindEnum = pgEnum("asset_kind", [
>   "board",
>   "widget",
>   "image",
>   "video",
>   "case_study",
>   "rich_snippet",
> ]);
> ```
>
> **Cek:** `pnpm --filter @repo/db typecheck`.

## Fase 5 — Tabel fondasi: `site`, `subscription`, `integration`

> **Hasil:** tabel inti multi-tenant ada.
> **File:** `packages/db/src/schema.ts`.
> **Kerjakan:** (ikuti SRS §5; id cuid2 via `@paralleldrive/cuid2`)
>
> ```ts
> import { createId } from "@paralleldrive/cuid2";
> import { index, integer, jsonb } from "drizzle-orm/pg-core";
>
> export const site = pgTable(
>   "site",
>   {
>     id: text("id")
>       .primaryKey()
>       .$defaultFn(() => createId()),
>     organizationId: text("organization_id").notNull(),
>     name: text("name").notNull(),
>     domain: text("domain").notNull(),
>     siteKey: text("site_key")
>       .notNull()
>       .unique()
>       .$defaultFn(() => createId()),
>     pixelVerifiedAt: timestamp("pixel_verified_at"),
>     createdAt: timestamp("created_at").notNull().defaultNow(),
>   },
>   (t) => [index("site_org_idx").on(t.organizationId)],
> );
>
> export const subscription = pgTable("subscription", {
>   id: text("id")
>     .primaryKey()
>     .$defaultFn(() => createId()),
>   organizationId: text("organization_id").notNull().unique(),
>   plan: planEnum("plan").notNull().default("free"),
>   status: text("status").notNull().default("active"),
>   trafficQuota: integer("traffic_quota").notNull().default(2000),
>   provider: text("provider"),
>   renewsAt: timestamp("renews_at"),
> });
>
> export const integration = pgTable(
>   "integration",
>   {
>     id: text("id")
>       .primaryKey()
>       .$defaultFn(() => createId()),
>     organizationId: text("organization_id").notNull(),
>     provider: text("provider").notNull(),
>     config: jsonb("config").notNull(),
>     status: text("status").notNull().default("active"),
>     createdAt: timestamp("created_at").notNull().defaultNow(),
>   },
>   (t) => [index("integration_org_idx").on(t.organizationId)],
> );
> ```
>
> **Cek:** `pnpm add -w -F @repo/db @paralleldrive/cuid2` bila belum ada; typecheck hijau.

## Fase 6 — Tabel notifikasi: `notification`, `domain_setting`, `event`

> **Hasil:** tabel mesin notifikasi ada.
> **File:** `packages/db/src/schema.ts`.
> **Kerjakan:** salin dari SRS §5 (`notification`, `domain_setting`, `event`) — kolom `jsonb` untuk message/style/display/dataSource/timing/loop/privacy; index `notification_site_idx`, `event_site_occurred_idx`; `event.dedupeKey` unique.
> **Cek:** typecheck hijau.

## Fase 7 — Tabel testimonial: `testimonial_form`, `form_page`, `testimonial`, `asset`, `impression`

> **Hasil:** tabel mesin testimonial + shared ada.
> **File:** `packages/db/src/schema.ts`.
> **Kerjakan:** salin dari SRS §5; index `testimonial_site_status_idx`, `impression_site_created_idx`; FK ke `site`/`testimonial_form`.
> **Cek:** typecheck hijau.

## Fase 8 — Migrasi awal domain

> **Hasil:** semua tabel domain ter-apply ke DB.
> **File:** `packages/db/drizzle/*` (generated).
> **Kerjakan:** `pnpm db:generate` → **baca file SQL**, pastikan enum & index benar → `pnpm db:deploy`.
> **Cek:** `pnpm db:studio` menampilkan 11 tabel domain + tabel auth.

## Fase 9 — Kontrak Zod: bentuk `jsonb` notifikasi

> **Hasil:** satu sumber kebenaran untuk message/style/display/dataSource/timing.
> **File:** `packages/contracts/src/notifications.ts`.
> **Kerjakan:**
>
> ```ts
> import { z } from "zod";
> export const notificationMessageSchema = z.object({
>   template: z.string().min(1), // "{{first_name}} dari {{city}} baru beli {{product}}"
>   fallbacks: z.record(z.string(), z.string()).default({}),
>   hideTimeAgoAfterDays: z.number().int().positive().optional(),
> });
> export const notificationStyleSchema = z.object({
>   position: z.enum(["bottom-left", "bottom-right", "top-left", "top-right"]),
>   accent: z.string().regex(/^#([0-9a-f]{6})$/i),
>   shape: z.enum(["rounded", "square"]).default("rounded"),
>   size: z.enum(["sm", "md"]).default("md"),
>   animation: z.enum(["slide", "fade"]).default("slide"),
> });
> export const urlMatchSchema = z.object({
>   mode: z.enum(["all", "simple", "contains", "regex"]),
>   value: z.string().optional(),
> });
> export const notificationDisplaySchema = z.object({
>   url: urlMatchSchema,
>   countries: z.array(z.string()).optional(),
>   utm: z.record(z.string(), z.string()).optional(),
>   referrer: z.string().optional(),
> });
> export const notificationDataSourceSchema = z.object({
>   eventTypes: z.array(z.enum(["purchase", "signup", "visit", "form_submit", "custom"])),
>   filter: z.record(z.string(), z.unknown()).optional(),
> });
> export const notificationTimingSchema = z.object({
>   delayMs: z.number().int().min(0).default(0),
>   durationMs: z.number().int().min(1000).default(5000),
>   intervalMs: z.number().int().min(0).default(8000),
> });
> export const notificationConfigSchema = z.object({
>   message: notificationMessageSchema,
>   style: notificationStyleSchema,
>   display: notificationDisplaySchema,
>   dataSource: notificationDataSourceSchema,
>   timing: notificationTimingSchema,
> });
> export type NotificationConfig = z.output<typeof notificationConfigSchema>;
> ```
>
> **Cek:** tambah `notifications.test.ts` (parse happy + invalid hex) → `pnpm --filter @repo/contracts test`.

## Fase 10 — Kontrak Zod: payload widget publik

> **Hasil:** bentuk respons `/widget/v1/payload` & track/capture terkunci.
> **File:** `packages/contracts/src/widget.ts`.
> **Kerjakan:** (lihat contoh SRS §6.5)
>
> ```ts
> import { z } from "zod";
> export const widgetNotificationSchema = z.object({
>   id: z.string(),
>   type: z.string(),
>   verified: z.boolean(),
>   message: z.string(),
>   timeAgo: z.string().optional(),
>   style: z.object({ position: z.string(), accent: z.string() }).passthrough(),
> });
> export const widgetPayloadResponseSchema = z.object({
>   notifications: z.array(widgetNotificationSchema),
>   settings: z.object({
>     loopAfter: z.number(),
>     order: z.enum(["random", "manual"]),
>     showClose: z.boolean(),
>     showBadge: z.boolean(),
>   }),
>   ttl: z.number().int().positive(),
> });
> export const trackEventSchema = z.object({
>   refId: z.string(),
>   siteKey: z.string(),
>   kind: z.enum(["view", "click"]),
> });
> export const captureEventSchema = z.object({
>   siteKey: z.string(),
>   url: z.string(),
>   fields: z.record(z.string(), z.string()),
> });
> export type WidgetPayloadResponse = z.output<typeof widgetPayloadResponseSchema>;
> ```
>
> **Cek:** test parse.

## Fase 11 — Kontrak Zod: sites, events, forms, testimonials, assets, billing

> **Hasil:** sisa kontrak domain ada (buat skeleton, isi field saat modulnya digarap).
> **File:** `packages/contracts/src/{sites,events,forms,testimonials,assets,billing}.ts`.
> **Kerjakan:** minimal `createXSchema`/`updateXSchema` + response; detail menyusul di fase epiknya.
> **Cek:** typecheck + `pnpm check:boundaries`.

## Fase 12 — Queue registry + processor skeleton

> **Hasil:** 4 queue Tacto terdaftar; worker jalan.
> **File:** `packages/contracts/src/jobs.ts`, `packages/queue/src/index.ts`, `apps/worker/src/worker.ts`, `apps/worker/src/processors/{webhook,analytics-aggregate,counter-recompute,automation}.ts`.
> **Kerjakan:**
>
> 1. `jobs.ts`: nama + skema payload tiap queue:
>    ```ts
>    export const webhookQueueName = "webhook";
>    export const webhookJobSchema = z.object({
>      provider: z.string(),
>      siteId: z.string(),
>      raw: z.record(z.string(), z.unknown()),
>    });
>    export const analyticsQueueName = "analytics-aggregate";
>    export const counterQueueName = "counter-recompute";
>    export const automationQueueName = "automation";
>    ```
> 2. `queue/index.ts`: `createQueue(name)` + `createQueueEvents(name)` pakai `REDIS_URL`.
> 3. `worker.ts`: registrasi `Worker` per queue → processor (no-op `console.log` dulu).
>    **Cek:** `pnpm --filter @repo/worker dev` log "listening" tiap queue; enqueue manual diterima.

---

# EPIK B — Auth & Org multi-tenant

## Fase 13 — Aktifkan organization plugin

> **Hasil:** Better Auth punya Org, member, invitation, role.
> **File:** `apps/api/src/modules/auth/auth.ts`, `packages/db/src/schema.ts`.
> **Kerjakan:**
>
> 1. `auth.ts`:
>    ```ts
>    import { admin, organization } from "better-auth/plugins";
>    // plugins: [admin({...}), organization({ allowUserToCreateOrganization: true })]
>    ```
> 2. Tambah tabel `organization`, `member`, `invitation` ke `schema.ts` (ikuti bentuk tabel Better Auth yang ada; penamaan konsisten).
> 3. `pnpm db:generate` → review → `pnpm db:deploy`.
>    **Cek:** `auth.$Infer` memunculkan tipe organization; migrasi apply.
>    **FR:** FR-AUTH-05.

## Fase 14 — Buat Org default saat sign-up

> **Hasil:** tiap user baru langsung punya 1 Org (`owner`).
> **File:** `apps/api/src/modules/auth/auth.ts`.
> **Kerjakan:** pakai `databaseHooks.user.create.after` (atau hook organization) → buat organization + member(owner) + baris `subscription(plan=free)`.
> **Cek:** register user baru → ada baris `organization`, `member(owner)`, `subscription`.
> **FR:** FR-AUTH-03, FR-BIL-01 (default free).

## Fase 15 — Middleware: inject `organizationId`

> **Hasil:** context request membawa Org aktif.
> **File:** `apps/api/src/modules/auth/middleware.ts`.
> **Kerjakan:** perluas `AuthVariables` → `organizationId: string | null`; di `createSessionMiddleware`, resolve Org aktif user (dari `member`) → `c.set("organizationId", ...)`. Tambah helper `requireOrg(c)`.
> **Cek:** endpoint ter-proteksi bisa baca `c.get("organizationId")`.
> **FR:** NFR-SEC-03.

## Fase 16 — UI undang anggota (opsional MVP)

> **Hasil:** owner bisa undang member via email.
> **File:** `apps/web/src/features/team/`, panggil endpoint organization Better Auth.
> **Cek:** undangan terkirim & member join masuk Org.
> **FR:** FR-AUTH-05.

---

# EPIK C — Site & Pixel

## Fase 17 — Kontrak sites final

> **File:** `packages/contracts/src/sites.ts`.
> **Kerjakan:**
>
> ```ts
> export const createSiteSchema = z.object({
>   name: z.string().trim().min(1),
>   domain: z.string().trim().min(1),
> });
> export const updateSiteSchema = createSiteSchema.partial();
> export const siteSchema = z.object({
>   id: z.string(),
>   name: z.string(),
>   domain: z.string(),
>   siteKey: z.string(),
>   pixelVerifiedAt: z.iso.datetime().nullable(),
>   createdAt: z.iso.datetime(),
> });
> ```
>
> **Cek:** test parse.

## Fase 18 — Service + Router Sites (CRUD, tenant-filtered)

> **Hasil:** CRUD `/api/v1/sites`.
> **File:** `apps/api/src/modules/sites/{services.ts,router.ts}`, wire di `app.ts`.
> **Kerjakan:**
>
> 1. `services.ts` (ikuti pola `users/services.ts`):
>    ```ts
>    export function createSitesService(
>      db: Pick<Database, "select" | "insert" | "update" | "delete">,
>    ) {
>      return { list, create, update, remove };
>      async function create(orgId: string, input: CreateSiteInput) {
>        const [row] = await db
>          .insert(site)
>          .values({ organizationId: orgId, ...input })
>          .returning();
>        return row;
>      }
>      async function list(orgId: string) {
>        return db
>          .select()
>          .from(site)
>          .where(eq(site.organizationId, orgId))
>          .orderBy(desc(site.createdAt));
>      }
>      // update/remove: filter eq(site.id,id) AND eq(site.organizationId,orgId)
>    }
>    ```
> 2. `router.ts`: `createSitesRouter(service)` dengan `.get("/")`, `.post("/", zValidator("json", createSiteSchema))`, `.patch("/:id")`, `.delete("/:id")`; ambil `orgId = requireOrg(c)`.
> 3. `app.ts`: `.use("/api/v1/sites", loadSession).route("/api/v1/sites", createSitesRouter(createSitesService(db)))`.
>    **Cek:** curl/RPC: user Org A tak bisa lihat Site Org B (dapat 403/kosong).
>    **FR:** FR-SITE-01/04.

## Fase 19 — Web: halaman Sites

> **Hasil:** daftar + form buat/edit Site di dashboard.
> **File:** `apps/web/src/features/sites/` (`services.ts`, `hooks/use-sites.ts`, `components/sites-page.tsx`), route `apps/web/src/routes/sites.tsx`.
> **Kerjakan:** TanStack Query (`queryKey: ["sites"]`) + mutation via `apiClient["api/v1/sites"].$post`; komponen pakai `@repo/ui` + token style guide.
> **Cek:** buat Site dari UI → muncul di daftar; dark/light ok.
> **FR:** FR-SITE-01.

## Fase 20 — Panel Install snippet + origin guard

> **Hasil:** snippet pixel ditampilkan; endpoint widget cek Origin.
> **File:** `apps/web/src/features/sites/components/install-panel.tsx`; `apps/api/src/modules/widget/` (helper `assertAllowedOrigin`).
> **Kerjakan:**
>
> 1. Tampilkan `<script src="{WIDGET_CDN_URL}/t.js" data-site="{siteKey}" async></script>` + tombol copy + instruksi GTM.
> 2. `assertAllowedOrigin(c, site.domain)` membandingkan `Origin`/`Referer`; tolak bila beda.
>    **Cek:** request payload dari domain asing ditolak.
>    **FR:** FR-SITE-02/03/06, NFR-SEC-05.

## Fase 21 — Verifikasi pixel terpasang

> **Hasil:** `pixelVerifiedAt` ter-set & status tampil.
> **File:** `apps/api/src/modules/widget/services.ts`; `apps/web/src/features/sites/`.
> **Kerjakan:** saat payload pertama terlayani utk Site dari domainnya & `pixelVerifiedAt` null → set `now()`. UI badge Verified + tombol "Cek ulang".
> **Cek:** pasang snippet di halaman uji → status jadi Verified.
> **FR:** FR-SITE-05.

---

# EPIK D — Widget runtime (`apps/widget` → `t.js`)

## Fase 22 — Scaffold `apps/widget` (Vite lib, no React)

> **Hasil:** build pipeline `t.js`.
> **File:** `apps/widget/{package.json,vite.config.ts,tsconfig.json,src/index.ts}`.
> **Kerjakan:**
>
> ```ts
> // vite.config.ts
> import { defineConfig } from "vite";
> export default defineConfig({
>   build: {
>     lib: { entry: "src/index.ts", name: "Tacto", fileName: () => "t.js", formats: ["iife"] },
>     minify: "esbuild",
>     target: "es2018",
>   },
> });
> ```
>
> `package.json` name `@repo/widget`, depend hanya `@repo/contracts`.
> **Cek:** `pnpm --filter @repo/widget build` → `dist/t.js`.
> **FR:** NFR-PERF-01.

## Fase 23 — Loader: baca `data-site` + fetch payload (fail-safe)

> **File:** `apps/widget/src/{index.ts,loader.ts}`.
> **Kerjakan:**
>
> ```ts
> // loader.ts
> export async function loadPayload(apiBase: string, siteKey: string, url: string) {
>   try {
>     const res = await fetch(
>       `${apiBase}/widget/v1/payload?site=${siteKey}&url=${encodeURIComponent(url)}`,
>       { credentials: "omit" },
>     );
>     if (!res.ok) return null;
>     return await res.json();
>   } catch {
>     return null;
>   } // fail-safe: jangan rusak situs host
> }
> ```
>
> `index.ts`: ambil `document.currentScript?.getAttribute("data-site")`, panggil loader; semua dibungkus `try/catch`.
> **Cek:** matikan API → situs host tetap normal, tanpa error ke console host.
> **FR:** NFR-REL-02.

## Fase 24 — Shadow DOM host + CSS terisolasi

> **File:** `apps/widget/src/shadow.ts`.
> **Kerjakan:** buat `<div>` + `attachShadow({mode:"open"})`; inject `<style>` token (warna style guide, inline minified). Semua render di dalam shadow root.
> **Cek:** style situs host tidak bocor ke widget & sebaliknya.
> **FR:** SRS §3.4, NFR-A11Y-01.

## Fase 25 — Render kartu notifikasi (signature component)

> **File:** `apps/widget/src/render/notification.ts`.
> **Kerjakan:** render kartu: ikon/foto, 1 fakta (`message`), `timeAgo`, baris "Verified by Tacto" bila `verified`. Markup & kelas meniru `.livecard` style guide.
> **Cek:** payload dummy → kartu tampil sesuai `style.position`/`accent`.
> **FR:** FR-NOT-01..05 (tampilan).

## Fase 26 — Scheduler: delay/durasi/interval/loop/urutan/close

> **File:** `apps/widget/src/scheduler.ts`.
> **Kerjakan:** antrikan notifikasi; terapkan `timing`; loop setelah `settings.loopAfter`; urutan `random`/`manual`; tombol close → simpan `localStorage` jeda X hari. Hormati `prefers-reduced-motion`.
> **Cek:** urutan & loop sesuai; close menyembunyikan sesuai durasi.
> **FR:** FR-NED-09, FR-NGS-01/02/03.

## Fase 27 — Beacon track + auto-capture form

> **File:** `apps/widget/src/{track.ts,capture.ts}`.
> **Kerjakan:**
>
> ```ts
> // track.ts
> export function track(apiBase: string, body: unknown) {
>   try {
>     navigator.sendBeacon(`${apiBase}/widget/v1/track`, JSON.stringify(body));
>   } catch {}
> }
> ```
>
> `capture.ts`: `document.addEventListener("submit", ...)` → sesuai URL match kirim ke `/widget/v1/capture`.
> **Cek:** klik notifikasi → `click` terkirim; submit form host → capture terkirim.
> **FR:** FR-ANL-01, FR-ING-01/10.

## Fase 28 — Render Testimonial Board / embed

> **File:** `apps/widget/src/render/testimonials.ts`.
> **Kerjakan:** untuk elemen `[data-tacto-asset]`, fetch `/widget/v1/testimonials?site=&asset=` → render grid/carousel/badge di shadow DOM.
> **Cek:** bundle total `t.js` tetap < 30 KB gzip (`gzip -c dist/t.js | wc -c`).
> **FR:** FR-TAS-01/02, NFR-PERF-01.

---

# EPIK E — Mesin notifikasi

## Fase 29 — Service + Router Notifications (CRUD)

> **File:** `apps/api/src/modules/notifications/{services.ts,router.ts}`, `app.ts`.
> **Kerjakan:** CRUD `/api/v1/notifications` per `siteId`; body `message/style/display/dataSource/timing` divalidasi `notificationConfigSchema`; tenant guard (site milik org). Toggle `isActive` via `PATCH`.
> **Cek:** buat notifikasi tersimpan; `isActive=false` tak ikut payload.
> **FR:** FR-NED-11.

## Fase 30 — Endpoint payload publik + cache Redis

> **File:** `apps/api/src/modules/widget/{router.ts,services.ts}`.
> **Kerjakan:** `GET /widget/v1/payload`: validasi origin → ambil notifikasi `isActive` cocok `url` → bentuk `widgetPayloadResponseSchema` → `ttl` + simpan cache Redis (key `payload:{siteKey}:{urlHash}`).
> **Cek:** panggilan kedua dilayani dari cache; p95 < 150 ms lokal.
> **FR:** NFR-PERF-02/03.

## Fase 31 — Resolver template variabel + fallback (server)

> **File:** `apps/api/src/modules/widget/template.ts`.
> **Kerjakan:** fungsi `renderMessage(template, vars, fallbacks)` → ganti `{{first_name}}`,`{{city}}`,`{{product}}`,`{{time_ago}}`,`{{count}}`; trim + kapitalisasi; `time_ago > N hari → "recently"`. Hanya tampilkan nama depan + kota (GDPR).
> **Cek:** unit test resolver (var kosong → fallback; >N hari → recently).
> **FR:** FR-NED-01/02/04, NFR-PRIV-01.

## Fase 32 — Tipe: Recent Sales

> **File:** `apps/api/src/modules/widget/sources/recent-sales.ts`.
> **Kerjakan:** ambil `event` terbaru sesuai `dataSource.eventTypes` + filter → map ke `widgetNotification`.
> **Cek:** event purchase baru → muncul sebagai sales pop.
> **FR:** FR-NOT-01.

## Fase 33 — Tipe: Review

> **File:** `apps/api/src/modules/widget/sources/review.ts`.
> **Kerjakan:** ambil `testimonial(status=approved, rating>=X)` → kartu review.
> **Cek:** testimonial approved tampil sebagai notifikasi review.
> **FR:** FR-NOT-04.

## Fase 34 — Tipe: Counter (worker)

> **File:** `apps/worker/src/processors/counter-recompute.ts`, Redis cache.
> **Kerjakan:** job hitung agregat event per periode → simpan Redis `counter:{notificationId}`; payload baca dari Redis.
> **Cek:** counter naik saat event bertambah (via job terjadwal).
> **FR:** FR-NOT-02, FR-ANL-05.

## Fase 35 — Tipe: Live Visitors (Redis)

> **File:** `apps/api/src/modules/widget/sources/live-visitors.ts`.
> **Kerjakan:** beacon `view` → `ZADD visitors:{siteId} now member`; hitung window 5 menit (`ZREMRANGEBYSCORE` + `ZCARD`).
> **Cek:** buka 2 tab → counter live ≥ 2.
> **FR:** FR-NOT-03.

## Fase 36 — Tipe: Custom/Informational

> **File:** `apps/api/src/modules/widget/sources/custom.ts`.
> **Kerjakan:** teks/CTA statis dari `message` (tanpa data source).
> **Cek:** notifikasi "garansi 30 hari" tampil.
> **FR:** FR-NOT-05.

## Fase 37 — Editor notifikasi (web, wizard)

> **File:** `apps/web/src/features/notifications/` (`components/editor/*`, `hooks/use-notifications.ts`).
> **Kerjakan:** wizard panel **Type→Track→Display→Message→Style→Launch** (lihat FR-NED). Tiap panel menyetel bagian `notificationConfig`; simpan via RPC. Media fallback (image→icon→map→gravatar→flag).
> **Cek:** semua panel tersimpan & valid (ditolak bila hex salah, dll).
> **FR:** FR-NED-01..08.

## Fase 38 — Preview device real-time

> **File:** `apps/web/src/features/notifications/components/preview.tsx`.
> **Kerjakan:** render preview kartu (komponen React semantiknya sama dgn widget) toggle desktop/mobile dari state editor.
> **Cek:** ubah accent/posisi → preview langsung berubah.
> **FR:** FR-NED-10.

---

# EPIK F — Ingestion event

## Fase 39 — API key per site

> **File:** `packages/db/src/schema.ts` (kolom/ tabel `site_api_key` atau field di `integration`), `apps/api/src/modules/ingest/auth.ts`.
> **Kerjakan:** generate & verifikasi API key per site untuk endpoint ingest.
> **Cek:** request tanpa key valid → 401.
> **FR:** FR-ING-02 (dasar).

## Fase 40 — Ingest manual + idempotency + anonimisasi

> **File:** `apps/api/src/modules/ingest/{router.ts,services.ts}`, `packages/contracts/src/events.ts`.
> **Kerjakan:** `POST /ingest/v1/event` → simpan `event`; tolak duplikat via `dedupeKey` (unique → tangkap error → 409); simpan hanya `displayName` (nama depan) + `city`.
> **Cek:** kirim 2x dedupeKey sama → 1 tersimpan, 1 ditolak.
> **FR:** FR-ING-02/08/09.

## Fase 41 — Endpoint capture (auto form submit)

> **File:** `apps/api/src/modules/widget/router.ts` (`/widget/v1/capture`).
> **Kerjakan:** terima `captureEventSchema` → terapkan URL match All/Simple/Contains/Regex → `event(type=form_submit, source=pixel)`.
> **Cek:** submit form host → event form_submit.
> **FR:** FR-ING-01/10.

## Fase 42 — Rate-limit ingest

> **File:** `apps/api/src/modules/ingest/rate-limit.ts` (Redis token bucket).
> **Kerjakan:** batasi per siteKey/IP.
> **Cek:** flood → 429.
> **FR:** NFR-SEC-04, FR-VER-03 (anti-abuse).

## Fase 43 — Webhook masuk + verifikasi signature → enqueue

> **File:** `apps/api/src/modules/ingest/webhook.ts`.
> **Kerjakan:** `POST /ingest/v1/webhook/:provider` → verifikasi signature (secret integration) → `webhookQueue.add(...)`. Balas 202.
> **Cek:** signature salah → 401; benar → job masuk queue.
> **FR:** FR-ING-03/04.

## Fase 44 — Worker webhook → normalisasi → event

> **File:** `apps/worker/src/processors/webhook.ts`.
> **Kerjakan:** map payload provider → `event`; dari sumber tepercaya set `verified=true`.
> **Cek:** job webhook → `event(verified=true)` → notifikasi.
> **FR:** FR-ING-03, FR-VER-01.

---

# EPIK G — Mesin testimonial

## Fase 45 — Kontrak forms + konfigurasi langkah

> **File:** `packages/contracts/src/forms.ts`.
> **Kerjakan:** `formPageConfigSchema` discriminated union per `kind` (rating skala, question teks/video, consent, about_you, about_company, welcome, thank_you); `testimonialFormSchema` (design, reward opsional).
> **Cek:** test parse per kind.
> **FR:** FR-TST-01/02/04/05/06/07.

## Fase 46 — Service + Router Forms (CRUD + pages)

> **File:** `apps/api/src/modules/forms/{services.ts,router.ts}`, `app.ts`.
> **Kerjakan:** CRUD `testimonial_form` + `form_page` (urut `order`) per site; slug unik.
> **Cek:** buat form multi-langkah tersimpan berurut.
> **FR:** FR-TST-01.

## Fase 47 — Route form publik `GET /form/:slug`

> **File:** `apps/api/src/modules/forms/public.ts` (atau route SPA publik).
> **Kerjakan:** kembalikan konfig funnel publik (tanpa data sensitif).
> **Cek:** buka `/form/:slug` → konfig langkah termuat.
> **FR:** FR-TST-01.

## Fase 48 — Web: form builder

> **File:** `apps/web/src/features/forms/`.
> **Kerjakan:** builder tambah/urut/hapus langkah; setel desain (warna/logo/branding).
> **Cek:** urutan langkah tersimpan & tampil di form publik.
> **FR:** FR-TST-04/08.

## Fase 49 — Form publik (UI) multi-langkah

> **File:** `apps/web/src/features/forms/public/*` + route publik.
> **Kerjakan:** render langkah berurut: welcome → rating → question → consent → about you (+upload foto) → about company → thank-you (opsi share).
> **Cek:** isi form ujung-ke-ujung di browser.
> **FR:** FR-TST-02/05/06/07.

## Fase 50 — Submit + sentiment routing + anti-XSS

> **File:** `apps/api/src/modules/forms/submit.ts`.
> **Kerjakan:** `POST /form/:slug/submit`: rating < ambang → `testimonial(isPrivateFeedback=true)` (tak publik); tinggi → lanjut consent → publik. Simpan `consentGiven`; sanitasi semua input. Upload foto via `@repo/storage` signed URL.
> **Cek:** rating rendah tak pernah publik; XSS string tersanitasi.
> **FR:** FR-TST-03, FR-TMG-02, NFR-SEC-06.

## Fase 51 — Moderasi testimonial

> **File:** `apps/api/src/modules/testimonials/{services.ts,router.ts}`, `apps/web/src/features/testimonials/`.
> **Kerjakan:** list by status; approve/reject/hide; tag; tab feedback privat terpisah.
> **Cek:** hanya `approved` tampil di aset; privat terisolasi.
> **FR:** FR-TMG-01/02.

## Fase 52 — Metrik form

> **File:** `apps/api/src/modules/forms/metrics.ts`, UI.
> **Kerjakan:** catat unique visit + submit; hitung response rate; tampilkan invites/visits/testimonials/rate.
> **Cek:** metrik akurat untuk form uji.
> **FR:** FR-TST-11.

---

# EPIK H — Studio (aset)

## Fase 53 — Kontrak + CRUD asset

> **File:** `packages/contracts/src/assets.ts`, `apps/api/src/modules/assets/`.
> **Kerjakan:** CRUD `asset` per site; `publicSlug` unik untuk aset publik.
> **Cek:** buat aset per kind.
> **FR:** FR-TAS-*.

## Fase 54 — Endpoint data testimonials untuk aset

> **File:** `apps/api/src/modules/widget/router.ts` (`/widget/v1/testimonials`).
> **Kerjakan:** kembalikan testimonial approved sesuai `asset.config`.
> **Cek:** data benar untuk `asset=board`.
> **FR:** FR-TAS-01/02.

## Fase 55 — Testimonial Board hosted page

> **File:** route publik `/board/:publicSlug` (SPA atau API).
> **Kerjakan:** halaman publik render Testimonial Board.
> **Cek:** URL publik menampilkan Testimonial Board.
> **FR:** FR-TAS-01.

## Fase 56 — Widget embed (grid/carousel/badge)

> **File:** `apps/widget/src/render/testimonials.ts` (perluas), UI generator embed.
> **Kerjakan:** 3 layout dari `asset.config`.
> **Cek:** embed tiap layout tampil.
> **FR:** FR-TAS-02.

## Fase 57 — Image kartu siap-posting

> **File:** `apps/worker/src/processors/asset-image.ts` (render), `@repo/storage`.
> **Kerjakan:** render kartu gambar testimonial (mis. satori/SVG→PNG) → simpan storage → URL unduh.
> **Cek:** unduh kartu gambar valid.
> **FR:** FR-TAS-03.

---

# EPIK I — Analytics

## Fase 58 — Tulis impression (hot-path Redis)

> **File:** `apps/api/src/modules/widget/router.ts` (`/widget/v1/track`).
> **Kerjakan:** validasi `trackEventSchema` → push ke buffer Redis (list/stream) alih-alih langsung Postgres.
> **Cek:** track cepat; buffer bertambah.
> **FR:** FR-ANL-01.

## Fase 59 — Worker agregasi → Postgres

> **File:** `apps/worker/src/processors/analytics-aggregate.ts`.
> **Kerjakan:** flush buffer Redis → insert `impression` + rollup (per notif/site/periode).
> **Cek:** data impression muncul di Postgres setelah job.
> **FR:** FR-ANL-05.

## Fase 60 — Endpoint ringkasan analytics

> **File:** `apps/api/src/modules/analytics/{services.ts,router.ts}`.
> **Kerjakan:** `GET /api/v1/analytics?from&to` → impression, klik, CTR per periode (tenant-filtered).
> **Cek:** angka cocok dengan data.
> **FR:** FR-ANL-02.

## Fase 61 — Dashboard analytics + Events Feed

> **File:** `apps/web/src/features/analytics/`.
> **Kerjakan:** stat tile (tabular figures) + grafik (pakai skill `dataviz`) + Events Feed (log event).
> **Cek:** laporan 7 hari tampil; dark/light ok.
> **FR:** FR-ANL-02/06.

---

# EPIK J — Billing freemium

## Fase 62 — Definisi plan & limit (konstanta + kontrak)

> **File:** `packages/contracts/src/billing.ts`.
> **Kerjakan:** map plan → `{ trafficQuota, maxSites, removeBadge, notificationTypes }` (Free/Starter/Growth/Agency, lihat PRD §7.2).
> **Cek:** test map lengkap 4 plan.
> **FR:** FR-BIL-01.

## Fase 63 — Penegakan batas (middleware)

> **File:** `apps/api/src/modules/billing/guard.ts`.
> **Kerjakan:** cek `maxSites` saat buat Site; hitung visitor bulan (Redis) vs `trafficQuota` → batasi payload bila lewat (pesan + ajakan upgrade).
> **Cek:** Free buat Site ke-2 ditolak; kuota lewat → dibatasi.
> **FR:** FR-BIL-03.

## Fase 64 — Badge "Powered by Tacto"

> **File:** payload (`showBadge`) + `apps/widget/src/render/badge.ts`.
> **Kerjakan:** `showBadge = plan === "free"`; widget render badge.
> **Cek:** Free tampil badge; berbayar tidak.
> **FR:** FR-BIL-04.

## Fase 65 — Halaman billing (status plan)

> **File:** `apps/web/src/features/billing/`.
> **Kerjakan:** tampilkan plan, kuota terpakai, batas; CTA upgrade (Stripe menyusul F72).
> **Cek:** status akurat.
> **FR:** FR-BIL-01/03.

---

# EPIK K — Onboarding & Acceptance MVP

## Fase 66 — Onboarding checklist

> **File:** `apps/web/src/features/onboarding/`.
> **Kerjakan:** langkah: buat Site → pasang pixel → verifikasi → notifikasi pertama → (opsi) form. State dari data nyata (site, pixelVerifiedAt, count notifikasi).
> **Cek:** user baru dibimbing hingga notifikasi pertama.
> **FR:** PRD §3.2/§3.3.

## Fase 67 — Verified label + anti-abuse

> **File:** widget badge verified + ingest rate-limit (F42).
> **Kerjakan:** hanya event terverifikasi menampilkan ✓.
> **Cek:** event manual non-verified tak ber-✓.
> **FR:** FR-VER-03 (dasar VER-01/02).

## Fase 68 — E2E test alur MVP

> **File:** `apps/web/e2e/*` atau skrip integrasi.
> **Kerjakan:** skenario sign-up → Site → snippet → verifikasi → notifikasi (4 tipe) tampil hanya di domain terdaftar → capture + webhook → form funnel + routing + consent + moderasi → Board/widget/image → analytics → batas Free + badge.
> **Cek:** skenario hijau.
> **FR:** SRS §9.

## Fase 69 — Verifikasi deployment

> **File:** `docker-compose.yaml`, `Dockerfile`.
> **Kerjakan:** `docker compose up` menyalakan postgres/redis/api/worker/proxy; proxy serve `t.js` + SPA; migrasi jalan saat start api.
> **Cek:** 10 kriteria MVP SRS §9 terpenuhi end-to-end di satu box.
> **FR:** SRS §8/§9.

**→ Exit MVP: siap dijual ke pelanggan pertama (PRD §10).**

---

# EPIK L+ — Fase 2–4 (ringkas, code-level per task)

> Tiap item di bawah dipecah lebih detail (pola fase di atas) saat epiknya mulai digarap.

### Fase 2 — integrasi & konversi

- **F70** OAuth Google + reset password (`auth.ts` provider, web). — FR-AUTH-04/06
- **F71** Stripe checkout + webhook status langganan (`modules/billing`, worker). — FR-BIL-02/05
- **F72** Konektor Stripe/Shopify/WooCommerce (purchase→`event verified`). — FR-ING-06, FR-VER-01/02
- **F73** Zapier/Make (endpoint + dokumentasi key). — FR-ING-05
- **F74** Import review Google/Facebook (worker). — FR-ING-07, FR-TST-10
- **F75** A/B testing varian + Goals + dampak. — FR-ANL-03/04
- **F76** Reward/insentif (global/spin-wheel) di thank-you. — FR-TST-09
- **F77** Automasi auto-minta testimonial (trigger event → email). — FR-AUT-01/02
- **F78** Rich Snippet SEO + Custom CSS/JS + passthrough GA/GTM/Mixpanel/FB. — FR-TAS-06, FR-NGS-04/06

### Fase 3 — suite lengkap

- **F79** Tipe: Combo, Social Counter, YouTube, Low stock, Countdown. — FR-NOT-06/07
- **F80** Aset: Video embed, Case study. — FR-TAS-04/05
- **F81** Conversion widgets (popup, spin-to-win, bar, countdown).
- **F82** Privacy lanjut: profanity filter, block IP, country display, cegah duplikat; terjemahan template. — FR-NGS-07, FR-NED-12
- **F83** Katalog integrasi diperluas (Make/Pabbly/CRM/course).

### Fase 4 — ekspansi & AI

- **F84** "Use with AI" (draf pesan/ringkas review/saran copy).
- **F85** Katalog integrasi luas + optimisasi performa/biaya + penyempurnaan onboarding berbasis data.

---

# Lampiran — Definition of Done (per fase)

- [ ] Bentuk data baru → skema Zod di `@repo/contracts` (bukan tipe ganda).
- [ ] Error code baru → ditambahkan ke `apiErrorSchema` sebelum dipakai.
- [ ] Query domain difilter `organizationId`/`siteId`.
- [ ] Endpoint divalidasi `zValidator`; web memanggil via `@repo/api-client`.
- [ ] `pnpm check` + `pnpm typecheck` hijau; test terkait lulus.
- [ ] Migrasi ter-generate & ter-review (bukan `db:push` ke prod).
- [ ] UI pakai token [style-guide.md](../style-guide.md) (light+dark, focus ring, A11Y).
- [ ] Perubahan `apps/widget` menjaga `t.js` < 30 KB gzip & fail-safe.
