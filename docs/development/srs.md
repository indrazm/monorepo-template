# SRS — Tacto

**Software Requirements Specification**
Versi: 4.0 (notifications-only, monorepo) · Tanggal: 12 Oktober 2026 · Status: Draft
Stack: Monorepo pnpm · Hono (API) · TanStack Router SPA · Drizzle ORM · PostgreSQL · Better Auth · BullMQ + Redis · Docker Compose
Perubahan dari v3.0: **stack diselaraskan ke monorepo** (TanStack Start → Hono API + TanStack Router SPA; Prisma → Drizzle; auth → Better Auth + organization plugin; worker → BullMQ + Redis). **Scope tetap notifications-only** — tidak ada mesin testimonial/Wall of Love/form funnel (itu produk terpisah). Berbasis teardown WiserNotify & ProveSource.

---

## 1. Pendahuluan

### 1.1 Tujuan

Menjabarkan kebutuhan fungsional & non-fungsional sistem **Tacto**, platform _social proof notification_ SaaS global (tanpa modul testimonial).

### 1.2 Ruang Lingkup Perangkat Lunak

- **Dashboard (`apps/web`)** — SPA (TanStack Router + shadcn/ui): atur situs, notifikasi, integrasi, analytics/goals, billing.
- **API (`apps/api`)** — Hono: auth (Better Auth), manajemen data, endpoint publik widget, ingestion event, agregasi/render-data notifikasi.
- **Worker (`apps/worker`)** — BullMQ: proses webhook, agregasi analytics, kalkulasi counter/goal.
- **Pixel & widget (`apps/widget`)** — skrip `t.js` ringan di situs pelanggan: render notifikasi, auto-capture form submit, kirim impression/klik.
- **Integrasi** — pixel auto-capture, Custom Webhook, Zapier/Make, Stripe, Shopify, WooCommerce (bertahap) melalui satu framework konektor generik.

### 1.3 Definisi & Singkatan

| Istilah      | Arti                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------- |
| Notification | Unit social proof real-time (sales pop, counter, visitor, review, custom)                 |
| Event        | Data aktivitas (purchase, signup, visit, form-submit, custom) sumber notifikasi           |
| Pixel        | Skrip JS universal (`t.js`) yang dipasang di situs pelanggan                              |
| Site         | Properti web pelanggan tempat pixel dipasang                                              |
| Org          | Organisasi/akun pelanggan (multi-site, multi-user); dipetakan ke Better Auth organization |
| Goal         | Konversi yang dilacak untuk mengukur dampak notifikasi                                    |
| Verified     | Event dari sumber tepercaya (webhook/integrasi/purchase)                                  |
| Contract     | Skema Zod bersama di `packages/contracts` (validasi + tipe)                               |
| RPC          | Kontrak tipe end-to-end API→web via Hono client (`@repo/api-client`)                      |

### 1.4 Referensi

PRD-Tacto.md (v4), Tacto-Feature-Teardown.md; dokumentasi Hono, TanStack Router/Query, Drizzle ORM, Better Auth, BullMQ, PostgreSQL, Redis, Stripe, Shopify. Struktur folder: `structure-folder.md`.

---

## 2. Deskripsi Umum

### 2.1 Perspektif Produk

Sistem multi-tenant berbasis web, **satu monorepo** melayani banyak Org. Dashboard adalah SPA yang berkomunikasi dengan API (Hono) lewat RPC type-safe. Widget berjalan sebagai aset statis terpisah dari dashboard, memanggil API publik Tacto yang cacheable untuk mengambil notifikasi aktif per halaman. Seluruh surface berbagi kontrak data lewat `packages/contracts` (Zod).

### 2.2 Fungsi Utama

1. Manajemen akun & organisasi (multi-tenant, multi-site, multi-user) — via Better Auth + organization plugin.
2. Konfigurasi & editor notifikasi (tipe, teks, style, targeting, timing, data source).
3. Penyajian notifikasi real-time ke pengunjung via pixel (ringan, cacheable).
4. Ingestion event (pixel auto-capture, webhook, integrasi).
5. Analytics & Goals (impression, klik, CTR, konversi); Events Feed.
6. Pengaturan global per domain (loop, order, close, CSS, privacy).
7. Billing & langganan (kuota traffic).
8. Verified/ethical proof.

### 2.3 Kelas Pengguna

| Kelas                  | Hak akses                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------- |
| Visitor (end-user)     | Melihat notifikasi                                                                     |
| Member                 | Kelola site & notifikasi dalam org-nya                                                 |
| Admin Org              | Semua hak member + billing + kelola user (role `owner`/`admin` di organization plugin) |
| Super Admin (internal) | Kelola platform, dukungan                                                              |

### 2.4 Lingkungan Operasi

- **Runtime:** Node.js untuk `apps/api` (Hono via `@hono/node-server`) & `apps/worker` (BullMQ). PostgreSQL + Redis sebagai infra.
- **Dashboard:** SPA (Vite build) — diserve statik via proxy atau di-deploy ke Cloudflare. Browser modern.
- **Widget:** `t.js` — semua browser & semua CMS/platform.
- **Toolchain:** pnpm 10 (workspaces + catalog), TypeScript, oxlint + oxfmt (Oxc), Vitest, pemeriksaan batas modul (`check:boundaries`) & env (`check:env`).

### 2.5 Batasan Desain

- Pixel/widget ≤ 30 KB gzipped, async, tidak memblokir render situs.
- Endpoint publik widget cacheable & tahan beban (Hono, cocok edge/CDN).
- Data pribadi ditampilkan terbatas (nama depan + kota) sesuai GDPR.
- **Batas modul monorepo:** kode browser (`@repo/web`, `@repo/ui`, `@repo/contracts`, `@repo/api-client`, `@repo/widget`) tidak boleh meng-import infra server (`@repo/db`, `@repo/queue`, dll); tidak ada import relatif lintas-package (hanya public exports). Ditegakkan `scripts/check-boundaries.mjs`.

---

## 3. Arsitektur Sistem

### 3.1 Komponen

```
┌─────────────────────────────────────────────────────────┐
│                    Situs Pelanggan                        │
│  <script src="https://cdn.tacto.io/t.js" data-site=…>     │
│   • render notifikasi  • auto-capture form submit         │
│   • kirim impression/klik                                 │
└──────────┬────────────────────────────────────────────────┘
           │ HTTPS (API publik, cacheable)
           │
┌──────────▼───────────────┐      ┌──────────────────────────┐
│   apps/api  (Hono)        │◄─RPC─│   apps/web (SPA)          │
│  /widget/*                │ type │  TanStack Router + Query  │
│  /ingest/*  /api/v1/*     │ safe │  shadcn/ui (@repo/ui)     │
│  + Better Auth            │      │  (Cloudflare / proxy)     │
└───────┬───────────┬───────┘      └──────────────────────────┘
        │           │ enqueue jobs
        │ Drizzle   ▼
        │   ┌───────────────┐      ┌──────────────────────────┐
        │   │     Redis     │◄─────│  apps/worker (BullMQ)     │
        │   │ queue + cache │      │ webhook, agregasi,        │
        │   │ live counter  │      │ counter/goal              │
        │   └───────────────┘      └──────────┬───────────────┘
        ▼                                      │ Drizzle
┌───────────────────────────────────────────────▼──────────┐
│                    PostgreSQL (multi-tenant)               │
└────────────────────────────────────────────────────────────┘

packages/ bersama: contracts (Zod) · db (Drizzle) · queue (BullMQ defs)
                   api-client (Hono RPC) · ui (shadcn) · config · storage
```

### 3.2 Struktur Monorepo

```
apps/
  web/        Dashboard SPA (TanStack Router + Query, shadcn/ui)
  api/        Hono — publik widget, ingestion, API dashboard, Better Auth
  worker/     BullMQ consumer — webhook, agregasi, counter/goal
  widget/     t.js — vanilla JS bundle (Vite lib), ≤30 KB, no React
packages/
  contracts/  Skema Zod bersama (validasi API, payload job) + tipe
  db/         Skema Drizzle + migrations (drizzle-kit) + client
  queue/      Definisi queue/job BullMQ (nama queue + skema payload)
  api-client/ Hono RPC client (hc<AppType>) + helper
  ui/         Komponen shadcn/ui bersama
  config/     Konfigurasi runtime & database (env terpusat)
  storage/    Abstraksi storage (upload aset bila diperlukan)
```

### 3.3 Peran stack

- **Hono (`apps/api`):** satu service HTTP melayani endpoint publik widget (`/widget/*`), ingestion (`/ingest/*`), dan API dashboard terautentikasi (`/api/v1/*`). Mengekspor `AppType` → dashboard memanggil API full type-safe tanpa codegen.
- **Better Auth:** email/password, sesi (cookie httpOnly), OAuth Google, reset password; **organization plugin** menyediakan Org, keanggotaan, undang user, dan role (owner/admin/member). Tabel auth/tenancy dimiliki Better Auth.
- **Drizzle ORM (`packages/db`):** skema, query SQL-first, migration (drizzle-kit), type-safety. Isolasi tenant lewat filter `organizationId`/`siteId`.
- **PostgreSQL:** penyimpanan multi-tenant.
- **BullMQ + Redis (`apps/worker`, `packages/queue`):** antrean job (webhook, agregasi analytics, counter/goal). Redis juga untuk cache payload widget & hitung live-visitors.
- **TanStack Router SPA (`apps/web`):** dashboard di balik auth, shadcn/ui, TanStack Query untuk data server.
- **Docker Compose:** `postgres`, `redis`, `api`, `worker`, `proxy`.

### 3.4 Pixel & widget

Bundel vanilla JS terpisah (`apps/widget` → `t.js`): membaca `data-site`; memanggil `/widget/v1/payload?site=…&url=…` (notifikasi aktif + pengaturan); render di **shadow DOM**; **auto-capture form submit** (deteksi submit → kirim ke `/widget/v1/capture`); kirim `impression`/`click` via beacon. Berbagi tipe payload dari `packages/contracts`. **Fail-safe** (kegagalan tidak merusak situs).

---

## 4. Kebutuhan Fungsional

> Format ID: **FR-[modul]-[nomor]**. Prioritas: M=Must, S=Should, C=Could.

### 4.1 Auth & Organisasi

> Realisasi: **Better Auth** (core) + **organization plugin**. FR tetap, implementasi delegasi ke Better Auth.

| ID         | Kebutuhan                                                      | Pri |
| ---------- | -------------------------------------------------------------- | --- |
| FR-AUTH-01 | Registrasi email+password & login (Better Auth)                | M   |
| FR-AUTH-02 | Sesi aman (httpOnly cookie) + CSRF                             | M   |
| FR-AUTH-03 | Registrasi otomatis membuat Org default (organization plugin)  | M   |
| FR-AUTH-04 | OAuth Google                                                   | S   |
| FR-AUTH-05 | Undang user ke Org (role member/admin) via organization plugin | S   |
| FR-AUTH-06 | Reset password via email                                       | S   |

### 4.2 Site & Pixel

| ID         | Kebutuhan                                          | Pri |
| ---------- | -------------------------------------------------- | --- |
| FR-SITE-01 | Buat Site (nama + domain), `siteKey` unik          | M   |
| FR-SITE-02 | Satu snippet pixel universal                       | M   |
| FR-SITE-03 | Validasi domain (hanya tampil di domain terdaftar) | M   |
| FR-SITE-04 | Multi-site per Org (sesuai paket)                  | M   |
| FR-SITE-05 | Deteksi & **verifikasi pixel terpasang** (status)  | M   |
| FR-SITE-06 | Snippet via Google Tag Manager                     | S   |

### 4.3 Notifikasi — Tipe

| ID        | Kebutuhan                                                       | Pri |
| --------- | --------------------------------------------------------------- | --- |
| FR-NOT-01 | Sales pop (recent sales): nama, produk, lokasi, waktu           | M   |
| FR-NOT-02 | Counter (jumlah sales/lead/visit over period)                   | M   |
| FR-NOT-03 | Live visitors (jumlah pengunjung live)                          | M   |
| FR-NOT-04 | Custom/Informational (teks & CTA bebas, mis. "garansi 30 hari") | M   |
| FR-NOT-05 | Review (tampilkan review/rating dari event/integrasi)           | S   |
| FR-NOT-06 | Combo (jumlah besar aksi 24h/7/30 hari)                         | C   |
| FR-NOT-07 | Social counter, YouTube, FOMO/low-stock, Countdown              | C   |

### 4.4 Notifikasi — Editor (alur Type→Track→Display→Message→Style→Launch)

| ID        | Kebutuhan                                                                                                    | Pri |
| --------- | ------------------------------------------------------------------------------------------------------------ | --- |
| FR-NED-01 | **Message:** template dengan variabel (`{{first_name}}`,`{{city}}`,`{{product}}`,`{{time_ago}}`,`{{count}}`) | M   |
| FR-NED-02 | **Fallback values** untuk variabel kosong + trim & kapitalisasi                                              | M   |
| FR-NED-03 | **Media/ikon** dengan urutan prioritas fallback (image→icon→map→gravatar→flag)                               | S   |
| FR-NED-04 | Opsi "sembunyikan time-ago jika > N hari → 'recently'"                                                       | S   |
| FR-NED-05 | **Style:** warna, font, bentuk, ukuran                                                                       | M   |
| FR-NED-06 | **Position & animation:** posisi sudut, animasi masuk/keluar                                                 | M   |
| FR-NED-07 | **Display/targeting:** URL match (All/Simple/Contains/Regex); target Visitor, Country, UTM, Referrer         | M   |
| FR-NED-08 | **Track/data source:** pilih sumber event + filter data                                                      | M   |
| FR-NED-09 | **Timing:** delay, durasi tampil, interval antar notifikasi                                                  | M   |
| FR-NED-10 | **Preview device** (desktop/mobile) real-time                                                                | M   |
| FR-NED-11 | Aktif/nonaktif per notifikasi                                                                                | M   |
| FR-NED-12 | Terjemahan bahasa template                                                                                   | C   |

### 4.5 Notifikasi — Pengaturan global per domain

| ID        | Kebutuhan                                                                  | Pri |
| --------- | -------------------------------------------------------------------------- | --- |
| FR-NGS-01 | Loop notifikasi (mulai loop jika > N)                                      | M   |
| FR-NGS-02 | Urutan tampil: acak atau drag-and-drop manual                              | M   |
| FR-NGS-03 | Close setting (jeda semua X hari; ikon close)                              | M   |
| FR-NGS-04 | Custom CSS/JS                                                              | S   |
| FR-NGS-05 | Privacy & GDPR: consent cookie/tracking; track IP & geo; opsi simpan email | M   |
| FR-NGS-06 | Kirim event ke GA/GTM/Mixpanel/Facebook                                    | C   |
| FR-NGS-07 | Profanity filter, block IP, country-specific display, cegah duplikat       | C   |

### 4.6 Ingestion Event (data capture)

| ID        | Kebutuhan                                                             | Pri |
| --------- | --------------------------------------------------------------------- | --- |
| FR-ING-01 | **Pixel auto-capture form submission** (deteksi submit form di situs) | M   |
| FR-ING-02 | Event manual via dashboard/API (API key site)                         | M   |
| FR-ING-03 | **Custom Webhook** (terima event dari sumber apa pun)                 | M   |
| FR-ING-04 | Verifikasi signature webhook                                          | M   |
| FR-ING-05 | Where-to-capture: URL match All/Simple/Contains/Regex                 | M   |
| FR-ING-06 | Anonimisasi (nama depan + kota)                                       | M   |
| FR-ING-07 | Idempotency (tolak duplikat via dedupeKey)                            | M   |
| FR-ING-08 | Integrasi Zapier/Make                                                 | S   |
| FR-ING-09 | Integrasi Stripe (purchase), Shopify, WooCommerce                     | S   |
| FR-ING-10 | Import review Google/Facebook                                         | S   |
| FR-ING-11 | Events Feed (log event masuk, untuk debug)                            | S   |

### 4.7 Integrasi (framework)

| ID        | Kebutuhan                                                                       | Pri |
| --------- | ------------------------------------------------------------------------------- | --- |
| FR-INT-01 | Framework konektor generik (satu abstraksi: auth → poll/webhook → map ke Event) | M   |
| FR-INT-02 | Katalog integrasi di dashboard (connect/disconnect, status)                     | S   |
| FR-INT-03 | Data filtering per integrasi (kondisi event yang ditampilkan)                   | S   |
| FR-INT-04 | Zapier/Make sebagai pembuka ratusan app via 1 konektor                          | S   |

### 4.8 Verified / Ethical Proof

| ID        | Kebutuhan                                            | Pri |
| --------- | ---------------------------------------------------- | --- |
| FR-VER-01 | Event dari sumber tepercaya ditandai `verified=true` | S   |
| FR-VER-02 | Notifikasi dapat menampilkan label "✓ Verified"      | S   |
| FR-VER-03 | Cegah pembuatan event fiktif massal (anti-abuse)     | M   |

### 4.9 Analytics & Goals

| ID        | Kebutuhan                                                 | Pri |
| --------- | --------------------------------------------------------- | --- |
| FR-ANL-01 | Catat impression & klik per notifikasi & site             | M   |
| FR-ANL-02 | Ringkasan dashboard (impression, klik, CTR) per periode   | M   |
| FR-ANL-03 | **Goals:** definisikan konversi & lacak dampak notifikasi | S   |
| FR-ANL-04 | **A/B testing** varian notifikasi                         | S   |
| FR-ANL-05 | Agregasi oleh worker (asinkron, BullMQ)                   | S   |

### 4.10 Billing

| ID        | Kebutuhan                                                                | Pri |
| --------- | ------------------------------------------------------------------------ | --- |
| FR-BIL-01 | Paket Free/Starter/Growth/Agency berbasis **kuota traffic**              | M   |
| FR-BIL-02 | Pembayaran via Stripe (global)                                           | S   |
| FR-BIL-03 | Tegakkan batas (kuota visitor, jumlah situs, hapus badge, fitur premium) | M   |
| FR-BIL-04 | Badge "Powered by Tacto" pada tier gratis                                | M   |
| FR-BIL-05 | Upgrade/downgrade & status langganan                                     | S   |

---

## 5. Model Data (Drizzle ORM — ringkas)

> **Auth & tenancy** (tabel `User`, `Session`, `Account`, `Verification`, `organization`, `member`, `invitation`) dimiliki **Better Auth + organization plugin** — tidak didefinisikan ulang di sini. Semua tabel domain ber-tenant via `organizationId` (= id organization Better Auth) dan/atau `siteId`. Kontrak bentuk data (message/style/display/dll) divalidasi lewat skema Zod di `packages/contracts`.

```ts
// packages/db/src/schema.ts (ringkas — notifications-only)
import {
  pgTable,
  pgEnum,
  text,
  boolean,
  integer,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

// ---------- ENUMS ----------
export const planEnum = pgEnum("plan", ["free", "starter", "growth", "agency"]);
export const notificationTypeEnum = pgEnum("notification_type", [
  "recent_sales",
  "counter",
  "live_visitors",
  "review",
  "custom",
  "combo",
  "social_counter",
  "youtube",
  "low_stock",
  "countdown",
]);
export const eventTypeEnum = pgEnum("event_type", [
  "purchase",
  "signup",
  "visit",
  "form_submit",
  "custom",
]);

// ---------- FONDASI ----------
export const site = pgTable(
  "site",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    organizationId: text("organization_id").notNull(), // Better Auth org
    name: text("name").notNull(),
    domain: text("domain").notNull(),
    siteKey: text("site_key")
      .notNull()
      .unique()
      .$defaultFn(() => createId()),
    pixelVerifiedAt: timestamp("pixel_verified_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("site_org_idx").on(t.organizationId)],
);

export const subscription = pgTable("subscription", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  organizationId: text("organization_id").notNull().unique(),
  plan: planEnum("plan").notNull().default("free"),
  status: text("status").notNull().default("active"),
  trafficQuota: integer("traffic_quota").notNull().default(2000), // visitor/bln
  provider: text("provider"), // stripe
  renewsAt: timestamp("renews_at"),
});

export const integration = pgTable(
  "integration",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    organizationId: text("organization_id").notNull(),
    provider: text("provider").notNull(), // stripe|shopify|woocommerce|zapier|make|webhook
    config: jsonb("config").notNull(),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("integration_org_idx").on(t.organizationId)],
);

// ---------- MESIN NOTIFIKASI ----------
export const notification = pgTable(
  "notification",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    siteId: text("site_id")
      .notNull()
      .references(() => site.id),
    type: notificationTypeEnum("type").notNull(),
    message: jsonb("message").notNull(), // template + variabel + fallback
    style: jsonb("style").notNull(), // warna, posisi, animasi, ukuran
    display: jsonb("display").notNull(), // targeting: url match, visitor/country/utm/referrer
    dataSource: jsonb("data_source").notNull(), // sumber event + filter
    timing: jsonb("timing").notNull(), // delay, durasi, interval
    verified: boolean("verified").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("notification_site_idx").on(t.siteId)],
);

export const domainSetting = pgTable("domain_setting", {
  // pengaturan global per domain
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  siteId: text("site_id")
    .notNull()
    .unique()
    .references(() => site.id),
  loop: jsonb("loop").notNull(), // loop > N, urutan, close
  customCss: text("custom_css"),
  privacy: jsonb("privacy").notNull(), // consent, track IP/geo, store email
  analyticsPassthrough: jsonb("analytics_passthrough"),
});

export const event = pgTable(
  "event",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    siteId: text("site_id")
      .notNull()
      .references(() => site.id),
    type: eventTypeEnum("type").notNull(),
    source: text("source").notNull(), // pixel|webhook|zapier|stripe|shopify|manual
    verified: boolean("verified").notNull().default(false),
    displayName: text("display_name"),
    city: text("city"),
    payload: jsonb("payload"),
    dedupeKey: text("dedupe_key").unique(),
    occurredAt: timestamp("occurred_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("event_site_occurred_idx").on(t.siteId, t.occurredAt)],
);

// ---------- GOAL (Fase 2) & SHARED ----------
export const goal = pgTable("goal", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  siteId: text("site_id")
    .notNull()
    .references(() => site.id),
  name: text("name").notNull(),
  rule: jsonb("rule").notNull(), // definisi konversi (URL/event)
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const impression = pgTable(
  "impression",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    refId: text("ref_id").notNull(), // notificationId
    siteId: text("site_id")
      .notNull()
      .references(() => site.id),
    kind: text("kind").notNull(), // view | click
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("impression_site_created_idx").on(t.siteId, t.createdAt)],
);
```

> Catatan: counter live-visitors dan dedup impression hot-path ditahan di **Redis** lalu di-flush ke Postgres oleh worker (FR-ANL-05), demi NFR-PERF & SCALE.
> Catatan implementasi: schema kode saat ini masih memuat tabel `testimonial_form`/`form_page`/`testimonial`/`asset` dari draf sebelumnya — **di luar scope** dan tidak dipakai; disimpan agar migrasi tidak destruktif, dapat dibersihkan nanti. Tabel `goal` ditambahkan saat fitur Goals (Fase 2).

---

## 6. Antarmuka Eksternal (API)

> Semua endpoint diimplementasikan di `apps/api` (Hono). Dashboard memanggil `/api/v1/*` lewat **Hono RPC** (`@repo/api-client`), full type-safe. Payload divalidasi dengan skema Zod (`@repo/contracts`) via `@hono/zod-validator`.

### 6.1 Publik — widget (tanpa auth, cacheable, rate-limited)

| Method | Path                                           | Fungsi                                      |
| ------ | ---------------------------------------------- | ------------------------------------------- |
| GET    | `/widget/v1/payload?site=<siteKey>&url=<path>` | Notifikasi aktif + pengaturan untuk halaman |
| POST   | `/widget/v1/track`                             | Catat impression/klik (beacon)              |
| POST   | `/widget/v1/capture`                           | Pixel auto-capture form submit → event      |

### 6.2 Ingestion

| Method | Path                           | Fungsi                                                                 |
| ------ | ------------------------------ | ---------------------------------------------------------------------- |
| POST   | `/ingest/v1/event`             | Event manual/API (API key site)                                        |
| POST   | `/ingest/v1/webhook/:provider` | Webhook (stripe/shopify/custom; verifikasi signature) → enqueue BullMQ |

### 6.3 Dashboard (`/api/v1/*`, terautentikasi via Better Auth)

CRUD Site/Notification/DomainSetting/Integration/Goal/Subscription; endpoint analytics ringkasan & Events Feed. Auth & sesi ditangani Better Auth (`/api/auth/*`). Validasi role & tenant (`organizationId`) tiap operasi.

### 6.4 Contoh kontrak respons widget

```json
GET /widget/v1/payload?site=abc123&url=/products/shoe
{
  "notifications": [
    { "id":"n_1","type":"recent_sales","verified":true,
      "message":"Mike dari London baru saja membeli Nike Air",
      "timeAgo":"12 menit lalu",
      "style":{"position":"bottom-left","accent":"#3B82F6"},
      "timing":{"delayMs":3000,"durationMs":6000,"intervalMs":8000} }
  ],
  "settings": { "loopAfter": 3, "order": "random", "showClose": true, "showBadge": true },
  "ttl": 30
}
```

---

## 7. Kebutuhan Non-Fungsional

### 7.1 Performa

- NFR-PERF-01: `t.js` ≤ 30 KB gzipped, async, render notifikasi pertama < 1 dtk (4G).
- NFR-PERF-02: `/widget/v1/payload` p95 < 150 ms (dengan cache Redis/CDN).
- NFR-PERF-03: endpoint widget cacheable (CDN/edge; Hono ringan cocok edge), TTL konfigurabel.

### 7.2 Skalabilitas

- NFR-SCALE-01: endpoint publik stateless, scale horizontal (sesi di cookie, cache di Redis).
- NFR-SCALE-02: agregasi analytics & counter asinkron via BullMQ worker; worker scale terpisah dari api.

### 7.3 Keamanan

- NFR-SEC-01: HTTPS semua.
- NFR-SEC-02: hashing password ditangani Better Auth (scrypt default).
- NFR-SEC-03: isolasi tenant ketat (filter `organizationId`/`siteId` tiap query).
- NFR-SEC-04: verifikasi signature webhook; ingestion rate-limit & idempoten (dedupeKey).
- NFR-SEC-05: widget hanya layani domain terdaftar (anti pencurian siteKey).
- NFR-SEC-06: proteksi CSRF dashboard (Better Auth + CORS `CLIENT_ORIGINS`); sanitasi input (anti-XSS).
- NFR-SEC-07: batas modul monorepo ditegakkan (`check:boundaries`).

### 7.4 Privasi (GDPR/PDP)

- NFR-PRIV-01: tampil data terbatas (nama depan + kota).
- NFR-PRIV-02: consent sebelum tracking (opsi global per domain).
- NFR-PRIV-03: mekanisme hapus data atas permintaan; data minimization.

### 7.5 Keandalan

- NFR-REL-01: uptime ≥ 99,5%.
- NFR-REL-02: kegagalan widget fail-safe (tidak merusak situs pelanggan).
- NFR-REL-03: backup database harian; Redis AOF aktif agar job queue durable.

### 7.6 Lokalisasi & Aksesibilitas

- NFR-L10N-01: UI dashboard & template default Bahasa Inggris (pasar global); dukungan multi-bahasa template.
- NFR-A11Y-01: widget ARIA, dapat ditutup, tidak mengganggu aksesibilitas.

### 7.7 Observability

- NFR-OBS-01: logging terstruktur + error tracking.
- NFR-OBS-02: metrik dasar (request rate, latency, error rate); metrik queue BullMQ (jobs waiting/failed).

---

## 8. Deployment (Docker Compose)

### 8.1 Services

| Service    | Build/Image          | Fungsi                                                                  |
| ---------- | -------------------- | ----------------------------------------------------------------------- |
| `postgres` | `postgres:16-alpine` | Database utama                                                          |
| `redis`    | `redis:7-alpine`     | Queue BullMQ + cache payload + counter live-visitors                    |
| `api`      | Node (Hono)          | Endpoint publik widget, ingestion, API dashboard, Better Auth           |
| `worker`   | Node (BullMQ)        | Webhook, agregasi analytics, counter/goal                               |
| `proxy`    | `caddy`/`nginx`      | Reverse proxy + TLS + serve `t.js` (apps/widget) & SPA dashboard statik |

> Dashboard SPA bisa (a) diserve statik oleh `proxy`, atau (b) di-deploy ke Cloudflare (wrangler) terpisah; CORS diatur lewat `CLIENT_ORIGINS`.

### 8.2 docker-compose.yaml (indikatif, produksi)

```yaml
name: tacto
services:
  postgres: { image: postgres:16-alpine, ... } # healthcheck pg_isready
  redis: { image: redis:7-alpine, command: ["redis-server", "--appendonly", "yes"] }
  api: { build: ., command: sh -c "pnpm db:deploy && pnpm --filter @repo/api start" }
  worker: { build: ., command: ["pnpm", "--filter", "@repo/worker", "start"] }
  proxy: { image: caddy:2, ports: ["80:80", "443:443"] }
```

> Dev lokal: `docker-compose.dev.yaml` menjalankan `postgres` + `redis` saja; aplikasi via `pnpm dev` (parallel `apps/*`).

### 8.3 Env utama

`DATABASE_URL`, `REDIS_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `CLIENT_ORIGINS`, `VITE_API_URL`, `VITE_WIDGET_CDN_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (Fase 2).

### 8.4 Migrasi

`pnpm db:deploy` (drizzle-kit migrate) saat startup `api` (atau job terpisah). Generate migration: `pnpm db:generate`.

---

## 9. Kriteria Penerimaan (MVP)

Siap rilis MVP bila:

1. Registrasi (Better Auth) → buat Site → dapat snippet pixel & verifikasi terpasang. (AUTH, SITE)
2. Pixel menampilkan Sales pop, Counter, Live visitors, Custom sesuai targeting & timing. (NOT, NED)
3. Notifikasi hanya tampil di domain terdaftar & sesuai aturan URL. (SITE-03, NED-07)
4. Pixel **auto-capture form submission** & **Custom Webhook** menghasilkan event → notifikasi. (ING)
5. Pengaturan global (loop/urutan/close) berfungsi. (NGS)
6. Impression & klik tercatat & tampil di analytics. (ANL)
7. Batas paket Free ditegakkan (kuota traffic) & badge "Powered by Tacto" tampil. (BIL)
8. Widget memenuhi anggaran performa (≤30 KB, async, fail-safe). (NFR-PERF/REL)
9. Seluruh sistem jalan via `docker compose up` (postgres, redis, api, worker, proxy); dev via `pnpm dev`. (Bab 8)

---

## 10. Lampiran — Peta FR ke Fase

| Fase   | FR utama                                                                                                             |
| ------ | -------------------------------------------------------------------------------------------------------------------- |
| MVP    | AUTH-01..03, SITE-01..05, NOT-01..04, NED-01..11, NGS-01..03/05, ING-01..07, INT-01, ANL-01/02, BIL-01/03/04, VER-03 |
| Fase 2 | AUTH-04..06, NOT-05, ING-08..11, INT-02..04, VER-01/02, ANL-03..05, BIL-02/05, NGS-04                                |
| Fase 3 | NOT-06/07, NGS-06/07, NED-12, katalog integrasi luas                                                                 |
| Fase 4 | Conversion widgets (popup/spin-to-win/bar), optimisasi                                                               |
