# Rencana Implementasi (Code-Level) — Tacto

**Development Implementation Plan — langkah coding berscope kecil**
Versi: 3.0 (notifications-only, monorepo) · Tanggal: 12 Oktober 2026 · Status: Draft
Acuan: [prd.md](../prd.md) (v4) · [srs.md](../srs.md) (v4) · [style-guide.md](../style-guide.md) · [structure-folder.md](../structure-folder.md)

> **Perubahan v3.0:** scope dipersempit ke **notifications-only** (mesin testimonial/Wall of Love dihapus — produk terpisah). Stack tetap monorepo (Hono + Drizzle + Better Auth + BullMQ/Redis). EPIK testimonial & Studio dibuang; ditambah **EPIK Integrasi (framework)** dan **Goals** di analytics. Tabel `testimonial*`/`asset` yang terlanjur ada di DB disimpan sebagai _reserved/unused_ (tak merusak migrasi).

---

## Cara pakai dokumen ini

Satu fase = satu task berscope kecil yang bisa dikerjakan & di-commit sekali duduk. Kerjakan berurutan.

Format: **Hasil · File · Kerjakan · Cek · FR**.

### Konvensi repo (WAJIB)

- **Modul API:** `apps/api/src/modules/<x>/` → `router.ts` (export `create<X>Router(service)`) + `services.ts` (export `create<X>Service(db)`); di-wire di `app.ts` via `.route()` + `.use("/path", loadSession)`.
- **Kontrak:** skema Zod di `packages/contracts/src/<x>.ts`, tipe via `z.output<...>`, import `@repo/contracts/<x>`.
- **Error:** `apiError("code")` dari `@repo/contracts/errors`; tambahkan code ke enum `apiErrorSchema` dulu.
- **Validasi:** `zValidator(...)` dari `@hono/zod-validator`.
- **DB:** tabel snake_case, id cuid2; `db:generate` → review SQL → `db:deploy` (jangan `db:push` ke prod).
- **RPC:** web → API hanya via `@repo/api-client` (`hc<AppType>`; `AppType` dari `@repo/api/types`).
- **Batas modul:** browser (`web`,`ui`,`contracts`,`api-client`,`widget`) tak boleh import `db`/`queue`/`storage`/`config`.
- **Tenant:** tiap query domain difilter `organizationId`/`siteId`.
- **Gate:** `pnpm check && pnpm typecheck` hijau + test terkait lulus.

### Indeks fase

| #       | Epik                        | Fase    |
| ------- | --------------------------- | ------- |
| EPIK A  | Fondasi                     | F1–F12  |
| EPIK B  | Auth & Org multi-tenant     | F13–F16 |
| EPIK C  | Site & Pixel                | F17–F21 |
| EPIK D  | Widget runtime (`t.js`)     | F22–F27 |
| EPIK E  | Mesin notifikasi            | F28–F37 |
| EPIK F  | Ingestion event             | F38–F43 |
| EPIK G  | Integrasi (framework)       | F44–F45 |
| EPIK H  | Analytics & Goals           | F46–F49 |
| EPIK I  | Billing freemium            | F50–F53 |
| EPIK J  | Onboarding & Acceptance MVP | F54–F57 |
| EPIK K+ | Fase 2–4 (ringkas)          | F58+    |

### Status progres

- ✅ **EPIK A — Fondasi (F1–F12)** selesai: rebrand, env/config, skema domain + migrasi, kontrak Zod, queue registry + worker.
- ✅ **EPIK B (F13–F15)** selesai: organization plugin, Org default saat sign-up, middleware `organizationId`. 🔜 **F16** (UI undang anggota) belum.
- ✅ **EPIK C (F17–F19)** selesai: kontrak sites, CRUD Sites API (tenant-filtered, uji isolasi pglite), halaman Sites + shell/tema Tacto + nav semua menu.
- ✅ **F28** (Notifications CRUD API) selesai. 🔜 **F20–F27, F29+** berikutnya.
- Catatan: `db:deploy` ke Postgres nyata menunggu Docker hidup; migrasi sudah ter-generate & diuji lewat pglite di test.
- Prasyarat (di luar penomoran): perbaikan tooling lintas-OS + `.gitattributes` (commit `chore`), dokumen dev (commit `docs`).

---

# EPIK A — Fondasi

## Fase 1 — Rename identitas repo ✅

> **Hasil:** repo bernama `tacto`. **File:** `package.json`, `auth.ts`, `README.md`, compose, wrangler.
> **Cek:** `git grep monorepo-template` kosong (kecuali lockfile).

## Fase 2 — Env matrix ✅

> **Hasil:** env Tacto tercatat. **File:** `.env.example`, `.env`.
> **Kerjakan:** `REDIS_URL`, `VITE_WIDGET_CDN_URL` (Stripe/Google/S3 ditunda ke fasenya). **Cek:** `pnpm check:env`.

## Fase 3 — Config runtime ✅

> **File:** `apps/api/src/config.ts` (+`REDIS_URL`), `apps/worker/src/config.ts` (+`DATABASE_URL`), `apps/web/src/config.ts` (+`VITE_WIDGET_CDN_URL`). **Cek:** `pnpm check:env`.

## Fase 4 — Enum Drizzle domain ✅

> **File:** `packages/db/src/schema.ts`. Enum: `plan`, `notification_type`, `event_type` (+`form_page_kind`/`testimonial_status`/`asset_kind` reserved). **Cek:** `pnpm --filter @repo/db typecheck`.

## Fase 5 — Tabel fondasi ✅

> **File:** `schema.ts`. Tabel `site`, `subscription`, `integration` (tenant via `organization_id`, index). **Cek:** typecheck.

## Fase 6 — Tabel notifikasi ✅

> **File:** `schema.ts`. `notification`, `domain_setting`, `event` (jsonb message/style/display/dataSource/timing/loop/privacy; index; `event.dedupeKey` unique). **Cek:** typecheck.

## Fase 7 — Tabel shared ✅

> **File:** `schema.ts`. `impression` (index `impression_site_created_idx`). Tabel `testimonial*`/`asset` ada sebagai _reserved/unused_. Tabel `goal` ditambah di F47 (Goals, Fase 2). **Cek:** typecheck.

## Fase 8 — Migrasi awal domain ✅

> **File:** `packages/db/drizzle/0001_*.sql`. **Kerjakan:** `db:generate` → review (additive, no drop) → `db:deploy` saat Postgres hidup. **Cek:** `db:studio` menampilkan tabel.

## Fase 9 — Kontrak notifikasi ✅

> **Hasil:** sumber kebenaran message/style/display/dataSource/timing + create/update/response.
> **File:** `packages/contracts/src/notifications.ts` (+ `notifications.test.ts`).
> **Kerjakan:** `notificationConfigSchema` (message, style hex, urlMatch, display, dataSource eventTypes, timing) + `createNotificationSchema`/`updateNotificationSchema`/`notificationSchema`.
> **Cek:** `pnpm --filter @repo/contracts test`.
> **FR:** FR-NED-01..09.

## Fase 10 — Kontrak payload widget ✅

> **File:** `packages/contracts/src/widget.ts`.
> **Kerjakan:** `widgetPayloadResponseSchema` (notifications + settings{loopAfter,order,showClose,closeForDays,showBadge,requireConsent} + ttl), `widgetPayloadQuerySchema`, `trackEventSchema`, `captureEventSchema`.
> **Cek:** typecheck. **FR:** SRS §6.4.

## Fase 11 — Kontrak sites, events, billing ✅

> **File:** `packages/contracts/src/{sites,events,billing}.ts`.
> **Kerjakan:** sites (create/update/site + domainSetting{loop,privacy,customCss}); events (ingest + feed); billing (plan limits map + `planAllowsNotificationType`).
> **Cek:** typecheck + `pnpm check:boundaries`. **FR:** FR-SITE, FR-ING, FR-BIL-01.

## Fase 12 — Queue registry + processor skeleton ✅

> **File:** `packages/contracts/src/jobs.ts`, `packages/queue/src/index.ts`, `apps/worker/src/worker.ts`, `apps/worker/src/processors/{webhook,analytics-aggregate,counter-recompute}.ts`.
> **Kerjakan:**
>
> 1. `jobs.ts`: `webhookQueueName`+`webhookJobSchema`, `analyticsQueueName`, `counterQueueName` (+payload Zod).
> 2. `queue/index.ts`: `createQueue(name)` + `createQueueEvents(name)` pakai `REDIS_URL`.
> 3. `worker.ts`: registrasi `Worker` per queue → processor (no-op dulu).
>    **Cek:** `pnpm --filter @repo/worker dev` log "listening" tiap queue.
>    **FR:** NFR-SCALE-02, FR-ANL-05.

---

# EPIK B — Auth & Org multi-tenant

## Fase 13 — Aktifkan organization plugin ✅

> **File:** `apps/api/src/modules/auth/auth.ts`, `packages/db/src/schema.ts`.
> **Kerjakan:** tambah plugin `organization()`; tabel `organization`/`member`/`invitation`; `db:generate`→review→deploy.
> **Cek:** `auth.$Infer` memunculkan tipe org; migrasi apply. **FR:** FR-AUTH-05.

## Fase 14 — Org default saat sign-up ✅

> **File:** `auth.ts`. **Kerjakan:** hook after-create user → buat organization + member(owner) + `subscription(plan=free)`.
> **Cek:** register → baris organization/member/subscription. **FR:** FR-AUTH-03, FR-BIL-01.

## Fase 15 — Middleware inject `organizationId` ✅

> **File:** `apps/api/src/modules/auth/middleware.ts`. **Kerjakan:** `AuthVariables.organizationId`; resolve org aktif; helper `requireOrg(c)`.
> **Cek:** endpoint terproteksi baca `c.get("organizationId")`. **FR:** NFR-SEC-03.

## Fase 16 — UI undang anggota (opsional MVP)

> **File:** `apps/web/src/features/team/`. **Kerjakan:** panggil endpoint organization Better Auth.
> **Cek:** undangan terkirim. **FR:** FR-AUTH-05.

---

# EPIK C — Site & Pixel

## Fase 17 — Kontrak sites final ✅

> **File:** `packages/contracts/src/sites.ts` (sudah di F11). **Cek:** test parse. **FR:** FR-SITE-01.

## Fase 18 — Service + Router Sites (CRUD, tenant-filtered) ✅

> **File:** `apps/api/src/modules/sites/{services.ts,router.ts}`, wire `app.ts`.
> **Kerjakan:** CRUD `/api/v1/sites` per `organizationId`; `siteKey` auto; validasi `createSiteSchema`.
> **Cek:** Org A tak lihat Site Org B. **FR:** FR-SITE-01/04.

## Fase 19 — Web: halaman Sites ✅

> **File:** `apps/web/src/features/sites/`, route `routes/sites.tsx`.
> **Kerjakan:** daftar + form (TanStack Query, `@repo/ui`, token style guide). **Cek:** buat Site dari UI. **FR:** FR-SITE-01.

## Fase 20 — Panel Install snippet + origin guard

> **File:** `apps/web/src/features/sites/components/install-panel.tsx`; `apps/api/src/modules/widget/` (`assertAllowedOrigin`).
> **Kerjakan:** snippet `<script src="{WIDGET_CDN_URL}/t.js" data-site>` + GTM; origin check domain.
> **Cek:** domain asing ditolak. **FR:** FR-SITE-02/03/06, NFR-SEC-05.

## Fase 21 — Verifikasi pixel terpasang

> **File:** `apps/api/src/modules/widget/services.ts`, web.
> **Kerjakan:** set `pixelVerifiedAt` saat payload pertama; badge status + "Cek ulang".
> **Cek:** pasang snippet → Verified. **FR:** FR-SITE-05.

---

# EPIK D — Widget runtime (`apps/widget` → `t.js`)

## Fase 22 — Scaffold `apps/widget` (Vite lib, no React)

> **File:** `apps/widget/{package.json,vite.config.ts,tsconfig.json,src/index.ts}`.
> **Kerjakan:** Vite `lib` IIFE → `t.js`; depend hanya `@repo/contracts`. **Cek:** build → `dist/t.js`. **FR:** NFR-PERF-01.

## Fase 23 — Loader: baca `data-site` + fetch payload (fail-safe)

> **File:** `apps/widget/src/{index.ts,loader.ts}`. **Kerjakan:** fetch `/widget/v1/payload` dibungkus try/catch.
> **Cek:** API mati → situs host normal. **FR:** NFR-REL-02.

## Fase 24 — Shadow DOM host + CSS terisolasi

> **File:** `apps/widget/src/shadow.ts`. **Cek:** style tidak bocor. **FR:** SRS §3.4, NFR-A11Y-01.

## Fase 25 — Render kartu notifikasi

> **File:** `apps/widget/src/render/notification.ts`. **Kerjakan:** kartu ikon/fakta/timeAgo + baris Verified; meniru `.livecard` style guide.
> **Cek:** payload dummy → kartu sesuai posisi/accent. **FR:** FR-NOT-01..04.

## Fase 26 — Scheduler: delay/durasi/interval/loop/urutan/close

> **File:** `apps/widget/src/scheduler.ts`. **Kerjakan:** timing + loop + urutan + close (localStorage jeda X hari); hormati `prefers-reduced-motion`.
> **Cek:** urutan/loop/close sesuai. **FR:** FR-NED-09, FR-NGS-01/02/03.

## Fase 27 — Beacon track + auto-capture form

> **File:** `apps/widget/src/{track.ts,capture.ts}`. **Kerjakan:** `sendBeacon` view/click; listener submit → `/widget/v1/capture` (URL match).
> **Cek:** klik→click; submit→capture. Bundle `t.js` < 30 KB gzip. **FR:** FR-ANL-01, FR-ING-01/05.

---

# EPIK E — Mesin notifikasi

## Fase 28 — Service + Router Notifications (CRUD) ✅

> **File:** `apps/api/src/modules/notifications/{services.ts,router.ts}`, `app.ts`.
> **Kerjakan:** CRUD `/api/v1/notifications` per `siteId`; body `notificationConfigSchema`; tenant guard; toggle `isActive`.
> **Cek:** buat tersimpan; inactive tak ikut payload. **FR:** FR-NED-11.

## Fase 29 — Endpoint payload publik + cache Redis

> **File:** `apps/api/src/modules/widget/{router.ts,services.ts}`.
> **Kerjakan:** pilih notifikasi aktif cocok `url` → `widgetPayloadResponseSchema` + `ttl` + cache Redis.
> **Cek:** panggilan kedua dari cache; p95 < 150 ms. **FR:** NFR-PERF-02/03.

## Fase 30 — Resolver template variabel + fallback

> **File:** `apps/api/src/modules/widget/template.ts`. **Kerjakan:** `renderMessage(template,vars,fallbacks)` + trim/kapitalisasi + time-ago>N→recently; nama depan + kota saja.
> **Cek:** unit test. **FR:** FR-NED-01/02/04, NFR-PRIV-01.

## Fase 31 — Tipe: Recent Sales

> **File:** `.../widget/sources/recent-sales.ts`. **Kerjakan:** `event` terbaru sesuai dataSource → widgetNotification. **FR:** FR-NOT-01.

## Fase 32 — Tipe: Counter (worker)

> **File:** `apps/worker/src/processors/counter-recompute.ts` + Redis. **Kerjakan:** agregat event/periode → Redis `counter:{notificationId}`. **FR:** FR-NOT-02, FR-ANL-05.

## Fase 33 — Tipe: Live Visitors (Redis)

> **File:** `.../widget/sources/live-visitors.ts`. **Kerjakan:** beacon view → `ZADD visitors:{siteId}`; window 5 menit. **Cek:** 2 tab → ≥2. **FR:** FR-NOT-03.

## Fase 34 — Tipe: Custom/Informational

> **File:** `.../widget/sources/custom.ts`. **Kerjakan:** teks/CTA statis. **Cek:** "garansi 30 hari" tampil. **FR:** FR-NOT-04.

## Fase 35 — Editor notifikasi (web, wizard)

> **File:** `apps/web/src/features/notifications/` (`components/editor/*`, `hooks/use-notifications.ts`).
> **Kerjakan:** wizard **Type→Track→Display→Message→Style→Launch**; media fallback (image→icon→map→gravatar→flag).
> **Cek:** panel tersimpan & tervalidasi. **FR:** FR-NED-01..08.

## Fase 36 — Preview device real-time

> **File:** `.../notifications/components/preview.tsx`. **Kerjakan:** preview desktop/mobile dari state editor. **FR:** FR-NED-10.

## Fase 37 — Tipe: Review (Should → Fase 2)

> **File:** `.../widget/sources/review.ts`. **Kerjakan:** sumber review dari **event review / integrasi import** (bukan testimonial engine). **FR:** FR-NOT-05 (S).

---

# EPIK F — Ingestion event

## Fase 38 — API key per site

> **File:** `schema.ts` (field/tabel key), `apps/api/src/modules/ingest/auth.ts`. **Cek:** tanpa key → 401. **FR:** FR-ING-02.

## Fase 39 — Ingest manual + idempotency + anonimisasi

> **File:** `apps/api/src/modules/ingest/{router.ts,services.ts}`, `contracts/events.ts`.
> **Kerjakan:** `POST /ingest/v1/event` → `event`; dedupeKey unique → 409; simpan displayName(nama depan)+city.
> **Cek:** 2× dedupe → 1 tersimpan. **FR:** FR-ING-02/06/07.

## Fase 40 — Endpoint capture (auto form submit)

> **File:** `apps/api/src/modules/widget/router.ts` (`/widget/v1/capture`). **Kerjakan:** URL match → `event(form_submit, pixel)`.
> **Cek:** submit host → event. **FR:** FR-ING-01/05.

## Fase 41 — Rate-limit ingest

> **File:** `apps/api/src/modules/ingest/rate-limit.ts` (Redis). **Cek:** flood → 429. **FR:** NFR-SEC-04, FR-VER-03.

## Fase 42 — Webhook + signature → enqueue

> **File:** `apps/api/src/modules/ingest/webhook.ts`. **Kerjakan:** verifikasi signature → `webhookQueue.add` → 202.
> **Cek:** signature salah → 401. **FR:** FR-ING-03/04.

## Fase 43 — Worker webhook → event

> **File:** `apps/worker/src/processors/webhook.ts`. **Kerjakan:** map payload → `event`; sumber tepercaya `verified=true`.
> **Cek:** job → event → notifikasi. **FR:** FR-ING-03, FR-VER-01.

---

# EPIK G — Integrasi (framework)

## Fase 44 — Framework konektor generik

> **Hasil:** satu abstraksi konektor: `auth → poll/webhook → map ke Event`.
> **File:** `apps/api/src/modules/integrations/{services.ts,router.ts}`, `packages/contracts/src/integrations.ts`.
> **Kerjakan:** definisikan interface konektor (`id`, `verifySignature?`, `mapToEvent(raw)→IngestEvent`); registry provider; CRUD `integration` per org; webhook (F42) & manual (F39) memakai konektor sesuai `provider`. Webhook generik ("custom") sebagai konektor default.
> **Cek:** integrasi "custom webhook" terdaftar → event masuk via konektornya. **FR:** FR-INT-01 (MVP).

## Fase 45 — Katalog integrasi (UI, Should)

> **File:** `apps/web/src/features/integrations/`. **Kerjakan:** daftar provider, connect/disconnect, status.
> **Cek:** connect custom webhook dari UI. **FR:** FR-INT-02/03/04 (Fase 2).

---

# EPIK H — Analytics & Goals

## Fase 46 — Tulis impression (hot-path Redis)

> **File:** `apps/api/src/modules/widget/router.ts` (`/widget/v1/track`). **Kerjakan:** validasi `trackEventSchema` → buffer Redis.
> **Cek:** track cepat; buffer bertambah. **FR:** FR-ANL-01.

## Fase 47 — Worker agregasi → Postgres (+ tabel `goal`)

> **File:** `apps/worker/src/processors/analytics-aggregate.ts`; `schema.ts` (+`goal`, migrasi).
> **Kerjakan:** flush buffer Redis → `impression` + rollup. Tambah tabel `goal` (dipakai penuh di Fase 2).
> **Cek:** impression muncul di Postgres. **FR:** FR-ANL-05 (+ANL-03 dasar).

## Fase 48 — Endpoint ringkasan analytics

> **File:** `apps/api/src/modules/analytics/{services.ts,router.ts}`. **Kerjakan:** `GET /api/v1/analytics?from&to` → impression/klik/CTR (tenant-filtered).
> **Cek:** angka cocok. **FR:** FR-ANL-02.

## Fase 49 — Dashboard analytics + Events Feed

> **File:** `apps/web/src/features/analytics/`. **Kerjakan:** stat tile (tabular) + grafik (skill `dataviz`) + Events Feed (log event masuk).
> **Cek:** laporan 7 hari; dark/light. **FR:** FR-ANL-02, FR-ING-11.

---

# EPIK I — Billing freemium

## Fase 50 — Definisi plan & limit ✅ (kontrak di F11)

> **File:** `packages/contracts/src/billing.ts`. **Kerjakan:** map plan → `{trafficQuota,maxSites,removeBadge,notificationTypes}` + helper. **FR:** FR-BIL-01.

## Fase 51 — Penegakan batas (middleware)

> **File:** `apps/api/src/modules/billing/guard.ts`. **Kerjakan:** cek `maxSites` saat buat Site; visitor bulan (Redis) vs `trafficQuota` → batasi payload + ajakan upgrade.
> **Cek:** Free Site ke-2 ditolak. **FR:** FR-BIL-03.

## Fase 52 — Badge "Powered by Tacto"

> **File:** payload (`showBadge`) + `apps/widget/src/render/badge.ts`. **Kerjakan:** `showBadge = plan==="free"`.
> **Cek:** Free tampil badge. **FR:** FR-BIL-04.

## Fase 53 — Halaman billing (status plan)

> **File:** `apps/web/src/features/billing/`. **Kerjakan:** plan, kuota terpakai, batas; CTA upgrade (Stripe di Fase 2).
> **Cek:** status akurat. **FR:** FR-BIL-01/03.

---

# EPIK J — Onboarding & Acceptance MVP

## Fase 54 — Onboarding checklist

> **File:** `apps/web/src/features/onboarding/`. **Kerjakan:** buat Site → pasang pixel → verifikasi → notifikasi pertama (state dari data nyata).
> **Cek:** user baru dibimbing. **FR:** PRD §3.2/§3.3.

## Fase 55 — Verified label + anti-abuse

> **File:** widget badge verified + rate-limit (F41). **Kerjakan:** hanya event terverifikasi ber-✓.
> **Cek:** event non-verified tak ber-✓. **FR:** FR-VER-03.

## Fase 56 — E2E test alur MVP

> **File:** `apps/web/e2e/*` / skrip integrasi. **Kerjakan:** sign-up → Site → snippet → verifikasi → 4 tipe notifikasi tampil hanya di domain terdaftar & sesuai URL → capture + webhook → loop/order/close → analytics → batas Free + badge.
> **Cek:** skenario hijau. **FR:** SRS §9.

## Fase 57 — Verifikasi deployment

> **File:** `docker-compose.yaml`, `Dockerfile`. **Kerjakan:** `docker compose up` (postgres/redis/api/worker/proxy); proxy serve `t.js` + SPA; migrasi saat start api.
> **Cek:** 9 kriteria MVP SRS §9 terpenuhi. **FR:** SRS §8/§9.

**→ Exit MVP: bisa dipasang & dijual (PRD §10).**

---

# EPIK K+ — Fase 2–4 (ringkas, code-level per task)

### Fase 2 — transaksi nyata & konversi

- **F58** OAuth Google + reset password. — FR-AUTH-04/06
- **F59** Stripe checkout + webhook status langganan. — FR-BIL-02/05
- **F60** Konektor Stripe/Shopify/WooCommerce (purchase→`event verified`) via framework F44. — FR-ING-09, FR-VER-01/02
- **F61** Zapier/Make (endpoint + key). — FR-ING-08, FR-INT-04
- **F62** Import review Google/Facebook → review notifications. — FR-ING-10, FR-NOT-05
- **F63** Goals penuh + A/B testing varian. — FR-ANL-03/04
- **F64** Katalog integrasi UI lengkap + data filtering. — FR-INT-02/03
- **F65** Verified label lengkap + Custom CSS/JS + passthrough GA/GTM/Mixpanel/FB. — FR-VER-01/02, FR-NGS-04/06

### Fase 3 — suite lengkap

- **F66** Tipe: Combo, Social Counter, YouTube, Low stock, Countdown. — FR-NOT-06/07
- **F67** Privacy lanjut: profanity filter, block IP, country display, cegah duplikat; terjemahan template. — FR-NGS-07, FR-NED-12
- **F68** Katalog integrasi diperluas (BigCommerce/Wix/HubSpot/Typeform/Kajabi).

### Fase 4 — ekspansi

- **F69** Conversion widgets (popup, spin-to-win, bar) — arah "Boost".
- **F70** Optimisasi performa/biaya + penyempurnaan onboarding berbasis data aktivasi.

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
