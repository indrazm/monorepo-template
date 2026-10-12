# SRS — Tacto

**Software Requirements Specification**
Versi: 3.0 (global, monorepo) · Tanggal: 10 Oktober 2026 · Status: Draft
Stack: Monorepo pnpm · Hono (API) · TanStack Router SPA · Drizzle ORM · PostgreSQL · Better Auth · BullMQ + Redis · Docker Compose
Perubahan dari v2.0: **finalisasi arsitektur ke monorepo** — TanStack Start (fullstack SSR) diganti **Hono (API) + TanStack Router (SPA)**; Prisma → **Drizzle**; auth custom → **Better Auth (+ organization plugin)**; worker generik → **BullMQ** (menambah **Redis**). Scope fungsional (dua mesin: notifikasi + testimonial) tidak berubah. Berbasis teardown WiserNotify, ProveSource, Senja.

---

## 1. Pendahuluan

### 1.1 Tujuan

Menjabarkan kebutuhan fungsional & non-fungsional sistem **Tacto**, platform social proof SaaS global yang menyatukan dua mesin: **notifikasi social proof** dan **testimonial/review**.

### 1.2 Ruang Lingkup Perangkat Lunak

- **Dashboard (`apps/web`)** — SPA (TanStack Router + shadcn/ui): atur situs, notifikasi, form testimonial, aset, integrasi, analytics, billing.
- **API (`apps/api`)** — Hono: auth (Better Auth), manajemen data, endpoint publik widget, form publik, ingestion event, agregasi/render-data.
- **Worker (`apps/worker`)** — BullMQ: proses webhook, agregasi analytics, kalkulasi counter/goal, automasi trigger.
- **Pixel & widget (`apps/widget`)** — skrip `t.js` ringan di situs pelanggan: render notifikasi + render widget testimonial (Wall of Love), auto-capture event.
- **Collector testimonial** — halaman form publik multi-langkah (diserve oleh `apps/api` di `/form/*`, atau route publik SPA).
- **Integrasi** — pixel auto-capture, Custom Webhook, Zapier, Stripe, Shopify, WooCommerce (bertahap).

### 1.3 Definisi & Singkatan

| Istilah           | Arti                                                                                      |
| ----------------- | ----------------------------------------------------------------------------------------- |
| Notification      | Unit social proof real-time (sales pop, counter, visitor, review, custom)                 |
| Testimonial Form  | Form publik multi-langkah untuk mengumpulkan testimonial                                  |
| Sentiment routing | Mengarahkan rating tinggi→testimonial publik, rendah→feedback privat                      |
| Wall of Love      | Kumpulan testimonial yang ditampilkan sebagai widget/halaman                              |
| Asset (Studio)    | Output dari testimonial (Wall, widget, image, dll)                                        |
| Event             | Data aktivitas (purchase, signup, visit, custom) sumber notifikasi                        |
| Site              | Properti web pelanggan tempat pixel/widget dipasang                                       |
| Org               | Organisasi/akun pelanggan (multi-site, multi-user); dipetakan ke Better Auth organization |
| Contract          | Skema Zod bersama di `packages/contracts` (validasi + tipe)                               |
| RPC               | Kontrak tipe end-to-end API→web via Hono client (`@repo/api-client`)                      |
| PDP/GDPR          | Perlindungan data pribadi                                                                 |

### 1.4 Referensi

PRD-Tacto.md (v3), Tacto-Feature-Teardown.md; dokumentasi Hono, TanStack Router/Query, Drizzle ORM, Better Auth, BullMQ, PostgreSQL, Redis, Stripe, Shopify. Template basis: `github.com/indrazm/monorepo-template`.

---

## 2. Deskripsi Umum

### 2.1 Perspektif Produk

Sistem multi-tenant berbasis web, **satu monorepo** melayani banyak Org. Dashboard adalah SPA yang berkomunikasi dengan API (Hono) lewat RPC type-safe. Widget berjalan sebagai aset statis terpisah dari dashboard, memanggil API publik Tacto yang cacheable. Dua mesin (notifikasi, testimonial) berbagi fondasi (auth, site, analytics, billing) tetapi punya domain data masing-masing. Seluruh surface berbagi kontrak data lewat `packages/contracts` (Zod).

### 2.2 Fungsi Utama

1. Manajemen akun & organisasi (multi-tenant, multi-site, multi-user) — via Better Auth + organization plugin.
2. **Mesin notifikasi**: konfigurasi tipe, editor, targeting, data source, penyajian real-time.
3. **Mesin testimonial**: form funnel, moderasi, aset (Wall of Love/widget/image).
4. Ingestion event (pixel auto-capture, webhook, integrasi).
5. Analytics (impression, klik, CTR, goals, response rate form).
6. Billing & langganan (kuota traffic).
7. Verified/ethical proof.

### 2.3 Kelas Pengguna

| Kelas                  | Hak akses                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------- |
| Visitor (end-user)     | Melihat notifikasi/widget; mengisi form testimonial publik                             |
| Member                 | Kelola site, notifikasi, form dalam org-nya                                            |
| Admin Org              | Semua hak member + billing + kelola user (role `owner`/`admin` di organization plugin) |
| Super Admin (internal) | Kelola platform, moderasi, dukungan                                                    |

### 2.4 Lingkungan Operasi

- **Runtime:** Node.js untuk `apps/api` (Hono via `@hono/node-server`) & `apps/worker` (BullMQ). PostgreSQL + Redis sebagai infra.
- **Dashboard:** SPA (Vite build) — diserve statik via proxy atau di-deploy ke Cloudflare. Browser modern.
- **Widget:** `t.js` — semua browser & semua CMS/platform.
- **Toolchain:** pnpm 10 (workspaces + catalog), TypeScript, oxlint + oxfmt (Oxc), Vitest, pemeriksaan batas modul (`check:boundaries`) & env (`check:env`).

### 2.5 Batasan Desain

- Pixel/widget ≤ 30 KB gzipped, async, tidak memblokir render situs.
- Endpoint publik widget cacheable & tahan beban (Hono, cocok edge/CDN).
- Data pribadi ditampilkan terbatas (nama depan + kota) sesuai GDPR.
- **Batas modul monorepo:** kode browser (`@repo/web`, `@repo/ui`, `@repo/contracts`, `@repo/api-client`) tidak boleh meng-import infra server (`@repo/db`, `@repo/queue`, dll); tidak ada import relatif lintas-package (hanya public exports). Ditegakkan `scripts/check-boundaries.mjs`.

---

## 3. Arsitektur Sistem

### 3.1 Komponen

```
┌─────────────────────────────────────────────────────────┐
│                    Situs Pelanggan                        │
│  <script src="https://cdn.tacto.io/t.js" data-site=…>     │
│   • render notifikasi  • render Wall of Love              │
│   • auto-capture form submit  • kirim impression/klik     │
└──────────┬────────────────────────────────────────────────┘
           │ HTTPS (API publik, cacheable)
           │
┌──────────▼───────────────┐      ┌──────────────────────────┐
│   apps/api  (Hono)        │◄─RPC─│   apps/web (SPA)          │
│  /widget/*  /form/*       │ type │  TanStack Router + Query  │
│  /ingest/*  /api/v1/*     │ safe │  shadcn/ui (@repo/ui)     │
│  + Better Auth            │      │  (Cloudflare / proxy)     │
└───────┬───────────┬───────┘      └──────────────────────────┘
        │           │ enqueue jobs
        │ Drizzle   ▼
        │   ┌───────────────┐      ┌──────────────────────────┐
        │   │     Redis     │◄─────│  apps/worker (BullMQ)     │
        │   │ queue + cache │      │ webhook, agregasi,        │
        │   │ live counter  │      │ counter/goal, automasi    │
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
  api/        Hono — publik widget, form, ingestion, API dashboard, Better Auth
  worker/     BullMQ consumer — webhook, agregasi, counter/goal, automasi
  widget/     t.js — vanilla JS bundle (Vite lib), ≤30 KB, no React
packages/
  contracts/  Skema Zod bersama (validasi API, form, payload job) + tipe
  db/         Skema Drizzle + migrations (drizzle-kit) + client
  queue/      Definisi queue/job BullMQ (nama queue + skema payload)
  api-client/ Hono RPC client (hc<AppType>) + helper, dipakai web & integrasi
  ui/         Komponen shadcn/ui bersama
  config/     Konfigurasi runtime & database (env terpusat)
  storage/    Abstraksi storage (upload foto testimonial, image kartu)
```

### 3.3 Peran stack

- **Hono (`apps/api`):** satu service HTTP melayani endpoint publik widget (`/widget/*`), form publik (`/form/*`), ingestion (`/ingest/*`), dan API dashboard terautentikasi (`/api/v1/*`). Mengekspor `AppType` → dashboard memanggil API full type-safe tanpa codegen.
- **Better Auth:** email/password, sesi (cookie httpOnly), OAuth Google, reset password; **organization plugin** menyediakan Org, keanggotaan, undang user, dan role (owner/admin/member). Tabel auth/tenancy dimiliki Better Auth (tidak didefinisikan ulang di bawah).
- **Drizzle ORM (`packages/db`):** skema, query SQL-first, migration (drizzle-kit), type-safety. Isolasi tenant lewat filter `organizationId`/`siteId`.
- **PostgreSQL:** penyimpanan multi-tenant.
- **BullMQ + Redis (`apps/worker`, `packages/queue`):** antrean job (webhook, agregasi analytics, counter/goal, automasi). Redis juga untuk cache payload widget & hitung live-visitors.
- **TanStack Router SPA (`apps/web`):** dashboard di balik auth (tak butuh SSR), shadcn/ui, TanStack Query untuk data server.
- **Docker Compose:** `postgres`, `redis`, `api`, `worker`, `proxy`.

### 3.4 Pixel & widget

Bundel vanilla JS terpisah (`apps/widget` → `t.js`): membaca `data-site`; memanggil `/widget/v1/payload?site=…&url=…` (notifikasi aktif + widget config + pengaturan); render di **shadow DOM**; **auto-capture form submit** (deteksi submit form di halaman → kirim ke `/ingest`/`/widget/v1/capture`); kirim `impression`/`click` via beacon. Berbagi tipe payload dari `packages/contracts`. **Fail-safe** (kegagalan tidak merusak situs).

---

## 4. Kebutuhan Fungsional

> Format ID: **FR-[modul]-[nomor]**. Prioritas: M=Must, S=Should, C=Could.

### 4.1 Auth & Organisasi

> Realisasi: **Better Auth** (core) + **organization plugin**. FR tetap, implementasi delegasi ke Better Auth.

| ID         | Kebutuhan                                                      | Pri |
| ---------- | -------------------------------------------------------------- | --- |
| FR-AUTH-01 | Registrasi email+password & login (Better Auth)                | M   |
| FR-AUTH-02 | Sesi aman (httpOnly cookie) + proteksi CSRF                    | M   |
| FR-AUTH-03 | Registrasi otomatis membuat Org default (organization plugin)  | M   |
| FR-AUTH-04 | OAuth Google (umum di pasar ini)                               | S   |
| FR-AUTH-05 | Undang user ke Org (role member/admin) via organization plugin | S   |
| FR-AUTH-06 | Reset password via email                                       | S   |

### 4.2 Site & Pixel

| ID         | Kebutuhan                                              | Pri |
| ---------- | ------------------------------------------------------ | --- |
| FR-SITE-01 | Buat Site (nama + domain), `siteKey` unik              | M   |
| FR-SITE-02 | Satu snippet pixel universal untuk notifikasi + widget | M   |
| FR-SITE-03 | Validasi domain (hanya tampil di domain terdaftar)     | M   |
| FR-SITE-04 | Multi-site per Org (sesuai paket)                      | M   |
| FR-SITE-05 | Deteksi & **verifikasi pixel terpasang** (status)      | M   |
| FR-SITE-06 | Snippet via Google Tag Manager                         | S   |

### 4.3 Notifikasi — Tipe

| ID        | Kebutuhan                                                             | Pri |
| --------- | --------------------------------------------------------------------- | --- |
| FR-NOT-01 | Tipe: Recent Sales (sales pop)                                        | M   |
| FR-NOT-02 | Tipe: Counter (sales/lead/visit over period)                          | M   |
| FR-NOT-03 | Tipe: Live Visitors                                                   | M   |
| FR-NOT-04 | Tipe: Review (tampil review)                                          | M   |
| FR-NOT-05 | Tipe: Custom/Informational (teks & CTA bebas, mis. "garansi 30 hari") | M   |
| FR-NOT-06 | Tipe: Combo (jumlah besar aksi 24h/7/30 hari)                         | S   |
| FR-NOT-07 | Tipe: Social Counter (followers), YouTube, FOMO/Low stock, Countdown  | C   |

### 4.4 Notifikasi — Editor (struktur meniru WiserNotify/ProveSource: Type→Track→Display→Message→Style→Launch)

| ID        | Kebutuhan                                                                                                                 | Pri |
| --------- | ------------------------------------------------------------------------------------------------------------------------- | --- |
| FR-NED-01 | **Text/Message:** template dengan variabel (`{{first_name}}`,`{{city}}`,`{{product}}`,`{{time_ago}}`,`{{count}}`)         | M   |
| FR-NED-02 | **Fallback values** untuk variabel kosong + trim & kapitalisasi                                                           | M   |
| FR-NED-03 | **Media/ikon** dengan urutan prioritas fallback (image→icon→map→gravatar→flag)                                            | S   |
| FR-NED-04 | Opsi "sembunyikan time-ago jika > N hari → 'recently'"                                                                    | S   |
| FR-NED-05 | **Style:** warna, font, bentuk, ukuran                                                                                    | M   |
| FR-NED-06 | **Position & animation:** posisi (sudut), animasi masuk/keluar                                                            | M   |
| FR-NED-07 | **Display/targeting:** semua halaman / URL match (Simple/Contains/Regex); target Visitor, Country, UTM, Referrer, Cookies | M   |
| FR-NED-08 | **Data source (Track):** pilih sumber event + filter data                                                                 | M   |
| FR-NED-09 | **Timing:** delay, durasi tampil, interval antar notifikasi                                                               | M   |
| FR-NED-10 | **Preview device** (desktop/mobile) real-time                                                                             | M   |
| FR-NED-11 | Aktif/nonaktif per notifikasi                                                                                             | M   |
| FR-NED-12 | Terjemahan bahasa template                                                                                                | C   |

### 4.5 Notifikasi — Pengaturan global per domain

| ID        | Kebutuhan                                                                        | Pri |
| --------- | -------------------------------------------------------------------------------- | --- |
| FR-NGS-01 | Loop notifikasi (mulai loop jika > N)                                            | M   |
| FR-NGS-02 | Urutan tampil: acak atau drag-and-drop manual                                    | M   |
| FR-NGS-03 | Close setting (jeda semua X hari; ikon close)                                    | M   |
| FR-NGS-04 | Custom CSS/JS                                                                    | S   |
| FR-NGS-05 | Privacy & GDPR: minta consent cookie/tracking; track IP & geo; opsi simpan email | M   |
| FR-NGS-06 | Kirim event ke GA/GTM/Mixpanel/Facebook                                          | C   |
| FR-NGS-07 | Profanity filter, block IP, country-specific display, cegah duplikat             | C   |

### 4.6 Testimonial — Form Funnel (meniru Senja)

| ID        | Kebutuhan                                                                           | Pri |
| --------- | ----------------------------------------------------------------------------------- | --- |
| FR-TST-01 | Buat form testimonial multi-langkah dengan URL publik                               | M   |
| FR-TST-02 | **Rating page** (skala 1–5)                                                         | M   |
| FR-TST-03 | **Sentiment routing:** rating rendah → feedback privat; tinggi → testimonial publik | M   |
| FR-TST-04 | Pertanyaan kustom (tambah/ubah, teks + video)                                       | M   |
| FR-TST-05 | **Consent page** (izin pakai testimonial)                                           | M   |
| FR-TST-06 | About you (nama, foto, jabatan) & about company                                     | M   |
| FR-TST-07 | Welcome page & Thank-you page (opsi word-of-mouth/share)                            | M   |
| FR-TST-08 | Desain form (warna, logo, branding)                                                 | S   |
| FR-TST-09 | **Reward/insentif** (global reward / spin-the-wheel / none)                         | S   |
| FR-TST-10 | Import testimonial manual                                                           | S   |
| FR-TST-11 | Metrik form: invites, unique visits, testimonials, response rate                    | M   |

### 4.7 Testimonial — Manajemen & Aset (Studio)

| ID        | Kebutuhan                                                  | Pri |
| --------- | ---------------------------------------------------------- | --- |
| FR-TMG-01 | Moderasi: approve/reject/hide; tag                         | M   |
| FR-TMG-02 | Pisahkan feedback privat (tidak tampil publik)             | M   |
| FR-TAS-01 | Aset: **Wall of Love** (widget + halaman hosted)           | M   |
| FR-TAS-02 | Aset: **Widget embed** (grid/carousel/badge)               | M   |
| FR-TAS-03 | Aset: **Image kartu** siap-posting                         | M   |
| FR-TAS-04 | Aset: Video embed / Social video                           | C   |
| FR-TAS-05 | Aset: Case study                                           | C   |
| FR-TAS-06 | Aset: **Rich Snippet** (structured data SEO rating/review) | S   |

### 4.8 Ingestion Event (data capture)

| ID        | Kebutuhan                                                             | Pri |
| --------- | --------------------------------------------------------------------- | --- |
| FR-ING-01 | **Pixel auto-capture form submission** (deteksi submit form di situs) | M   |
| FR-ING-02 | Event manual via dashboard/API (API key site)                         | M   |
| FR-ING-03 | **Custom Webhook** (terima event dari sumber apa pun)                 | M   |
| FR-ING-04 | Verifikasi signature webhook                                          | M   |
| FR-ING-05 | Integrasi Zapier/Make                                                 | S   |
| FR-ING-06 | Integrasi Stripe (purchase), Shopify, WooCommerce                     | S   |
| FR-ING-07 | Import review Google/Facebook                                         | S   |
| FR-ING-08 | Anonimisasi (nama depan + kota)                                       | M   |
| FR-ING-09 | Idempotency (tolak duplikat via dedupeKey)                            | M   |
| FR-ING-10 | Where-to-capture: URL match All/Simple/Contains/Regex                 | M   |

### 4.9 Verified / Ethical Proof

| ID        | Kebutuhan                                                                         | Pri |
| --------- | --------------------------------------------------------------------------------- | --- |
| FR-VER-01 | Event dari sumber tepercaya (webhook/integrasi/purchase) ditandai `verified=true` | S   |
| FR-VER-02 | Notifikasi dapat menampilkan label "✓ Verified"                                   | S   |
| FR-VER-03 | Cegah pembuatan event fiktif massal (anti-abuse)                                  | M   |

### 4.10 Analytics & Goals

| ID        | Kebutuhan                                                 | Pri |
| --------- | --------------------------------------------------------- | --- |
| FR-ANL-01 | Catat impression & klik per notifikasi & site             | M   |
| FR-ANL-02 | Ringkasan dashboard (impression, klik, CTR) per periode   | M   |
| FR-ANL-03 | **Goals**: definisikan konversi & lacak dampak notifikasi | S   |
| FR-ANL-04 | **A/B testing** varian notifikasi                         | S   |
| FR-ANL-05 | Agregasi oleh worker (asinkron, BullMQ)                   | S   |
| FR-ANL-06 | Events Feed (log event masuk)                             | S   |

### 4.11 Billing

| ID        | Kebutuhan                                                                | Pri |
| --------- | ------------------------------------------------------------------------ | --- |
| FR-BIL-01 | Paket Free/Starter/Growth/Agency berbasis **kuota traffic**              | M   |
| FR-BIL-02 | Pembayaran via Stripe (global)                                           | S   |
| FR-BIL-03 | Tegakkan batas (kuota visitor, jumlah situs, hapus badge, fitur premium) | M   |
| FR-BIL-04 | Badge "Powered by Tacto" pada tier gratis                                | M   |
| FR-BIL-05 | Upgrade/downgrade & status langganan                                     | S   |

### 4.12 Automasi (fase 2)

| ID        | Kebutuhan                                                                        | Pri |
| --------- | -------------------------------------------------------------------------------- | --- |
| FR-AUT-01 | Trigger auto-minta testimonial setelah event (mis. Stripe purchase) — job BullMQ | S   |
| FR-AUT-02 | Kirim undangan form via email                                                    | S   |

---

## 5. Model Data (Drizzle ORM — ringkas)

> **Auth & tenancy** (tabel `user`, `session`, `account`, `verification`, `organization`, `member`, `invitation`) dimiliki **Better Auth + organization plugin** — tidak didefinisikan ulang di sini. Semua tabel domain ber-tenant via `organizationId` (= id organization Better Auth) dan/atau `siteId`. Field detail & index tambahan ditambah saat implementasi. Kontrak bentuk data (message/style/display/dll) divalidasi lewat skema Zod di `packages/contracts`.

```ts
// packages/db/src/schema.ts
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
export const formPageKindEnum = pgEnum("form_page_kind", [
  "rating",
  "negative_feedback",
  "welcome",
  "question",
  "consent",
  "about_you",
  "about_company",
  "thank_you",
]);
export const testimonialStatusEnum = pgEnum("testimonial_status", [
  "pending",
  "approved",
  "rejected",
  "hidden",
]);
export const assetKindEnum = pgEnum("asset_kind", [
  "wall",
  "widget",
  "image",
  "video",
  "case_study",
  "rich_snippet",
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
  (t) => ({ orgIdx: index("site_org_idx").on(t.organizationId) }),
);

// Paket & kuota per Org (menggantikan Org.plan/trafficQuota lama).
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

export const integration = pgTable("integration", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  organizationId: text("organization_id").notNull(),
  provider: text("provider").notNull(), // stripe|shopify|woocommerce|zapier|webhook
  config: jsonb("config").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

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
  (t) => ({ siteIdx: index("notification_site_idx").on(t.siteId) }),
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
  (t) => ({ siteOccurredIdx: index("event_site_occurred_idx").on(t.siteId, t.occurredAt) }),
);

// ---------- MESIN TESTIMONIAL ----------
export const testimonialForm = pgTable("testimonial_form", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  siteId: text("site_id")
    .notNull()
    .references(() => site.id),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  design: jsonb("design").notNull(),
  reward: jsonb("reward"), // none | global | spin_wheel
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const formPage = pgTable("form_page", {
  // langkah funnel
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  formId: text("form_id")
    .notNull()
    .references(() => testimonialForm.id),
  kind: formPageKindEnum("kind").notNull(),
  order: integer("order").notNull(),
  config: jsonb("config").notNull(),
});

export const testimonial = pgTable(
  "testimonial",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    siteId: text("site_id")
      .notNull()
      .references(() => site.id),
    formId: text("form_id").references(() => testimonialForm.id),
    authorName: text("author_name").notNull(),
    authorPhoto: text("author_photo"),
    role: text("role"),
    company: text("company"),
    rating: integer("rating"),
    text: text("text").notNull(),
    videoUrl: text("video_url"),
    isPrivateFeedback: boolean("is_private_feedback").notNull().default(false), // hasil sentiment routing
    consentGiven: boolean("consent_given").notNull().default(false),
    status: testimonialStatusEnum("status").notNull().default("pending"),
    tags: text("tags").array(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({ siteStatusIdx: index("testimonial_site_status_idx").on(t.siteId, t.status) }),
);

export const asset = pgTable("asset", {
  // output Studio (Wall of Love, widget, image, dll)
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  siteId: text("site_id")
    .notNull()
    .references(() => site.id),
  kind: assetKindEnum("kind").notNull(),
  config: jsonb("config").notNull(),
  publicSlug: text("public_slug").unique(),
});

// ---------- SHARED ----------
export const impression = pgTable(
  "impression",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    refId: text("ref_id").notNull(), // notificationId atau assetId
    siteId: text("site_id")
      .notNull()
      .references(() => site.id),
    kind: text("kind").notNull(), // view | click
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({ siteCreatedIdx: index("impression_site_created_idx").on(t.siteId, t.createdAt) }),
);
```

> Catatan: counter live-visitors dan dedup impression hot-path bisa ditahan di **Redis** lalu di-flush ke Postgres oleh worker (FR-ANL-05), demi NFR-PERF & SCALE.

---

## 6. Antarmuka Eksternal (API)

> Semua endpoint diimplementasikan di `apps/api` (Hono). Dashboard memanggil `/api/v1/*` lewat **Hono RPC** (`@repo/api-client`), full type-safe. Payload divalidasi dengan skema Zod (`@repo/contracts`) via `@hono/zod-validator`.

### 6.1 Publik — widget (tanpa auth, cacheable, rate-limited)

| Method | Path                                                | Fungsi                                    |
| ------ | --------------------------------------------------- | ----------------------------------------- |
| GET    | `/widget/v1/payload?site=<siteKey>&url=<path>`      | Nudge aktif + config widget untuk halaman |
| POST   | `/widget/v1/track`                                  | Catat impression/klik (beacon)            |
| POST   | `/widget/v1/capture`                                | Pixel auto-capture form submit            |
| GET    | `/widget/v1/testimonials?site=<siteKey>&asset=<id>` | Data Wall of Love/widget                  |

### 6.2 Form publik

| Method | Path                  | Fungsi                                                   |
| ------ | --------------------- | -------------------------------------------------------- |
| GET    | `/form/<slug>`        | Render/konfig form testimonial multi-langkah             |
| POST   | `/form/<slug>/submit` | Terima testimonial / feedback privat (sentiment routing) |

### 6.3 Ingestion

| Method | Path                           | Fungsi                                                                 |
| ------ | ------------------------------ | ---------------------------------------------------------------------- |
| POST   | `/ingest/v1/event`             | Event manual/API (API key site)                                        |
| POST   | `/ingest/v1/webhook/:provider` | Webhook (stripe/shopify/custom; verifikasi signature) → enqueue BullMQ |

### 6.4 Dashboard (`/api/v1/*`, terautentikasi via Better Auth)

CRUD Site/Notification/DomainSetting/TestimonialForm/FormPage/Testimonial/Asset/Integration/Subscription; endpoint analytics & goals; Events Feed. Auth & sesi ditangani Better Auth (`/api/auth/*`). Validasi role & tenant (`organizationId`) di setiap operasi.

### 6.5 Contoh kontrak respons widget

```json
GET /widget/v1/payload?site=abc123&url=/products/shoe
{
  "notifications": [
    { "id":"n_1","type":"recent_sales","verified":true,
      "message":"Mike dari London baru saja membeli Nike Air",
      "timeAgo":"12 menit lalu",
      "style":{"position":"bottom-left","accent":"#7c3aed"} }
  ],
  "settings": { "loopAfter": 3, "order": "random", "showClose": true },
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

- NFR-SCALE-01: endpoint publik stateless, scale horizontal (api tanpa state; sesi di cookie, cache di Redis).
- NFR-SCALE-02: agregasi analytics & counter asinkron via BullMQ worker; worker scale terpisah dari api.

### 7.3 Keamanan

- NFR-SEC-01: HTTPS semua.
- NFR-SEC-02: hashing password ditangani Better Auth (scrypt default).
- NFR-SEC-03: isolasi tenant ketat (filter `organizationId`/`siteId` tiap query).
- NFR-SEC-04: verifikasi signature webhook; ingestion rate-limit & idempoten (dedupeKey).
- NFR-SEC-05: widget hanya layani domain terdaftar (anti pencurian siteKey).
- NFR-SEC-06: proteksi CSRF dashboard (Better Auth + CORS `CLIENT_ORIGINS`); sanitasi input testimonial (anti-XSS).
- NFR-SEC-07: batas modul monorepo ditegakkan (`check:boundaries`) agar kode browser tak bocor import infra server.

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
| `api`      | Node (Hono)          | Endpoint publik widget, form, ingestion, API dashboard, Better Auth     |
| `worker`   | Node (BullMQ)        | Webhook, agregasi analytics, counter/goal, automasi                     |
| `proxy`    | `caddy`/`nginx`      | Reverse proxy + TLS + serve `t.js` (apps/widget) & SPA dashboard statik |

> Dashboard SPA bisa (a) diserve statik oleh `proxy` untuk kesederhanaan satu-box, atau (b) di-deploy ke Cloudflare (wrangler) terpisah — pilih salah satu; CORS diatur lewat `CLIENT_ORIGINS`.

### 8.2 docker-compose.yaml (indikatif, produksi)

```yaml
name: tacto
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: tacto
      POSTGRES_USER: tacto
      POSTGRES_PASSWORD: ${DB_PASSWORD:?set in .env}
    volumes: ["pgdata:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U tacto -d tacto"]
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    command: ["redis-server", "--appendonly", "yes"]
    volumes: ["redisdata:/data"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 10

  api:
    build: .
    env_file: .env
    environment:
      DATABASE_URL: postgresql://tacto:${DB_PASSWORD}@postgres:5432/tacto
      REDIS_URL: redis://redis:6379
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    command: sh -c "pnpm db:deploy && pnpm --filter @repo/api start"

  worker:
    build: .
    env_file: .env
    environment:
      DATABASE_URL: postgresql://tacto:${DB_PASSWORD}@postgres:5432/tacto
      REDIS_URL: redis://redis:6379
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
    command: ["pnpm", "--filter", "@repo/worker", "start"]

  proxy:
    image: caddy:2
    ports: ["80:80", "443:443"]
    depends_on: [api]

volumes:
  pgdata:
  redisdata:
```

> Dev lokal: `docker-compose.dev.yaml` menjalankan `postgres` + `redis` saja; aplikasi via `pnpm dev` (parallel `apps/*`).

### 8.3 Env utama

`DATABASE_URL`, `REDIS_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `CLIENT_ORIGINS`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `WIDGET_CDN_URL`, `API_URL`.

### 8.4 Migrasi

`pnpm db:deploy` (drizzle-kit migrate) saat startup `api` (atau job terpisah). Generate migration: `pnpm db:generate`.

---

## 9. Kriteria Penerimaan (MVP)

Siap rilis MVP bila:

1. Registrasi (Better Auth) → buat Site → dapat snippet pixel & verifikasi terpasang. (AUTH, SITE)
2. Pixel menampilkan notifikasi Sales pop, Counter, Live Visitors, Custom sesuai targeting & timing. (NOT, NED)
3. Notifikasi hanya tampil di domain terdaftar. (SITE-03)
4. Pixel **auto-capture form submission** & Custom Webhook menghasilkan event → notifikasi. (ING)
5. Form testimonial multi-langkah jalan dengan **sentiment routing + consent**; testimonial bisa dimoderasi. (TST, TMG)
6. Wall of Love + widget embed + image tampil dari testimonial yang disetujui. (TAS)
7. Impression & klik tercatat & tampil di analytics. (ANL)
8. Batas paket Free ditegakkan (kuota traffic) & badge "Powered by Tacto" tampil. (BIL)
9. Widget memenuhi anggaran performa (≤30 KB, async, fail-safe). (NFR-PERF/REL)
10. Seluruh sistem jalan via `docker compose up` (postgres, redis, api, worker, proxy); dev via `pnpm dev`. (Bab 8)

---

## 10. Lampiran — Peta FR ke Fase

| Fase   | FR utama                                                                                                                                                  |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MVP    | AUTH-01..03, SITE-01..05, NOT-01..05, NED-01..11, NGS-01..03/05, TST-01..08/11, TMG-01/02, TAS-01..03, ING-01..04/08..10, ANL-01/02, BIL-01/03/04, VER-03 |
| Fase 2 | AUTH-04..06, ING-05..07, TST-09/10, TAS-06, ANL-03..06, BIL-02/05, AUT-01/02, VER-01/02, NGS-04                                                           |
| Fase 3 | NOT-06/07, TAS-04/05, conversion widgets, NGS-06/07, NED-12, katalog integrasi luas                                                                       |
| Fase 4 | "Use with AI", optimisasi, ekspansi                                                                                                                       |
