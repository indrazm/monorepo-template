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

### Status progres — MVP + Fase 2 + Fase 3 + Fase 4 (inti) SELESAI (teknis) ✅

> ⚠️ **Baca juga [Audit — Kesesuaian Fitur dengan Proses Bisnis](#audit--kesesuaian-fitur-dengan-proses-bisnis)**
> di bawah. Status ✅ berarti fitur berjalan secara teknis, **bukan** jaminan
> sudah sesuai proses bisnis/kebermanfaatan. Beberapa fitur masih "CRUD-only"
> (mis. integrasi "connect" hanya generate key, kuota traffic belum ditegakkan,
> targeting UTM/referrer belum dieksekusi).

Jalur ujung-ke-ujung hidup & terverifikasi di Docker (Postgres+Redis+API+worker, + prod compose/Caddy): **sign-up / Google OAuth / reset password → Org default + Team → Site + snippet + verifikasi pixel → editor notifikasi (recent_sales, counter, combo, live_visitors, review, custom, low_stock/FOMO, countdown, popup/bar/spin-to-win) + preview + terjemahan → `t.js` (shadow DOM, ≈5.2 KB gzip) render + conversion widgets + consent GDPR + custom CSS + passthrough GA/GTM/FB/Mixpanel → ingest (pixel capture / API key / custom webhook + 44 konektor terverifikasi + data filter) → **worker BullMQ: webhook→event durabel, flush buffer impression Redis→Postgres, recompute counter ke cache Redis** → analytics (impression/klik/CTR + events feed) + Goals (konversi) → Billing freemium + Stripe checkout/webhook + badge → anti-abuse (block IP, profanity, country, rate-limit) → Overview + onboarding.**

- ✅ **MVP (EPIK A–J, F1–F57)** lengkap.
- ✅ **Fase 2:** F58 Google OAuth + reset password · F59 Stripe billing (checkout + webhook) · F60 konektor Stripe/Shopify/WooCommerce · F61 Zapier/Make · F63 Goals · F64 data filtering integrasi · F65 custom CSS + domain settings + passthrough analytics · F16 Team (undang anggota) · ~~F37 tipe Review~~ (dihapus 15 Okt 2026).
- ✅ **Fase 2 (lanjutan):** **FR-ANL-04 A/B testing varian** — variants per-notifikasi, bucketing deterministik per visitor (`vid`), kolom `impression.variant`, breakdown views/klik/CTR di Analytics + editor varian · **FR-NED-03 media fallback** (image→map→gravatar→flag, ikon tipe sebagai default).
- ✅ **Fase 3:** F66 Combo/Low-stock/Countdown · F67 block IP + profanity filter · **F68 katalog integrasi** (44 provider: BigCommerce, Wix, SquareSpace, Ecwid, PrestaShop, Magento, Paddle, Lemon Squeezy, Gumroad, SendOwl, Recharge, HubSpot, Typeform, Jotform, Formspree, Calendly, Kajabi, Teachable, Thinkific, Memberful, Circle, Kit, Mailchimp, ActiveCampaign, WordPress, Webflow, …) + **FR-NGS-07 country display** (geo dari header CDN) + **FR-NED-12 terjemahan template**.
- ✅ **Fase 4 (inti):** **F69 conversion widgets** — tipe `popup`, `bar`, `spin_to_win` (render di `t.js`, posisi `center`/`top-bar`/`bottom-bar`, editor + preview) + gating tipe per paket (FR-BIL-03).
- ✅ **Durabilitas worker + Redis (F43/F46/F47 + cache F32/F33):** API enqueue webhook ke BullMQ (worker menulis `event` terverifikasi, idempoten); impression di-buffer Redis (RPUSH) oleh API lalu di-flush worker terjadwal ke Postgres; live-visitors dihitung via Redis ZSET; counter/combo di-cache Redis + recompute oleh worker. Fallback sinkron dipertahankan untuk test/unit.
- ✅ **F70 (inti):** rate-limit ingestion via Redis (multi-instance, fallback in-memory) · endpoint **metrik aktivasi** (`/api/v1/analytics/activation`) + onboarding "First notification shown" & time-to-activation berbasis data nyata.
- ✅ **Penutupan gap:** **consent GDPR ditegakkan di pixel** (FR-NGS-05) · **cache payload widget di Redis** (NFR-PERF-03) · **Stripe Billing Portal** (FR-BIL-05) · **Events Feed paginasi cursor** (FR-ING-11) · **`storeEmail`** (FR-NGS-05) · **verifikasi Stripe test-mode** (checkout + portal via API Stripe nyata).
- ✅ **Perbaikan sesuai fungsi sebenarnya:** **Stripe pakai Price ID dari Dashboard** (`STRIPE_PRICE_*`, bukan nominal inline → harga konsisten) · **manualOrder drag-and-drop dihormati** oleh payload (FR-NGS-02) · **pixel kirim `visit` event** sekali per sesi sehingga kuota traffic bulanan terukur nyata (FR-BIL-01) · **integrasi diberi mode direct vs via Zapier/Make + langkah koneksi** (lihat [integrations.md](../integrations.md)).
- ✅ **Penyelarasan audit lanjutan (15 Okt 2026):** **RBAC per-role** (owner/admin vs member, `requireRole` di billing/sites/integrations) · **spin-to-win hadiah nyata** (pool hadiah berbobot, pengungkapan kupon/URL, pelacakan klaim) · **Analytics per-notifikasi + klaim** (FR-ANL-02) · **Events Feed filter** type/source/verified/cari (FR-ING-11) · **A/B signifikansi** (Wilson 95% CI + two-proportion z-test, FR-ANL-04) · **Goals event-based + tren harian + atribusi terbantu** (FR-ANL-03) · **Editor wizard 6 langkah + preview device + media eksplisit** (FR-NED-01..10) · **Privasi `trackIpGeo` + ekspor/hapus event** (NFR-PRIV-02/03) · **`/metrics` Prometheus + queue depth** (NFR-OBS-01/02) · **map ber-kunci opsional** (FR-NED-03).
- **Kualitas:** `pnpm check` + `pnpm typecheck` hijau; **133 test** (Vitest + integrasi pglite + e2e HTTP widget/billing + processor worker) lulus; `t.js` ≈6.9 KB gzip; build web+widget lolos.
- **Dihapus (keputusan produk, 15 Okt 2026):** **fitur Review dihapus sepenuhnya** — tipe notifikasi `review`, tipe event `review`, dan integrasi Google Places (`google_reviews`) dikeluarkan dari produk; enum DB, kode (API/widget/web), UI, env (`GOOGLE_MAPS_API_KEY`), dan test dibersihkan. Migrasi `0012` menghapus nilai enum + mem-purge baris lama.
- **Ditunda (opsional):**
  - Perluasan katalog integrasi lebih lanjut & optimisasi biaya/perf lanjutan — opsional.
- **Credential yang perlu diisi di `.env`:** `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` (diisi), `GOOGLE_CLIENT_ID`/`SECRET` (diisi), `RESEND_API_KEY` + `MAIL_FROM_EMAIL` (wajib di production; tanpa itu link email di-log saat development), `HUBSPOT_*`/`SHOPIFY_*` (placeholder opsional untuk konektor OAuth mendatang; integrasi webhook memakai secret per-integrasi di dashboard).

---

# Audit — Kesesuaian Fitur dengan Proses Bisnis

> Status **✅** pada EPIK di atas berarti fitur _ada dan berjalan secara teknis_
> (endpoint/skema/UI tersedia & teruji). Artinya **bukan** otomatis bahwa fitur
> sudah sesuai **proses bisnis dan kebermanfaatan sebenarnya**. Bagian ini adalah
> hasil audit ulang: temuan fitur yang masih **"CRUD-only"**, tidak dieksekusi
> penuh di runtime, atau tidak memberi nilai sesuai tujuan produk (WiserNotify/
> ProveSource parity). Setiap temuan memuat: kondisi saat ini · mengapa belum
> sesuai · perilaku yang benar · tugas implementasi (file) · FR.
>
> Prioritas disarankan: **A, E, B, C, D, G** (berdampak langsung ke nilai produk).

## A. Integrasi "Connect" baru sebatas generate key (FR-INT-01..04)

**Kondisi saat ini.** `apps/api/src/modules/integrations/` menyimpan `provider` +
`config.secret`. "Connect" = auto-generate secret (mode automation) atau paste
secret (mode direct). Tidak ada verifikasi koneksi, tidak ada OAuth, tidak ada
lifecycle.

**Mengapa belum sesuai.** Proses bisnis integrasi SaaS nyata adalah: authorize
(OAuth/API key) → subscribe webhook/poll → **verifikasi koneksi** → **petakan
field** → monitor status & error → disconnect (revoke). Yang ada sekarang hanya
satu langkah (secret), sehingga untuk banyak provider pengguna tak tahu harus
melakukan apa, dan tak bisa tahu koneksi berhasil/gagal.

**Perilaku yang benar.**

1. **Model koneksi eksplisit** per provider: `auth: "oauth" | "api_key" | "webhook" | "poll"`.
2. **Wizard Connect** menampilkan langkah spesifik platform (buka halaman webhook,
   salin secret, pilih event) — bukan sekadar form secret.
3. **Test connection**: tombol "Verify" mengirim ping/uji signature dan menampilkan
   status `connected | error | pending` + pesan.
4. **Connection health**: `integration` menyimpan `status`, `lastCheckedAt`,
   `lastError`, `webhookId` platform, dan **log event terakhir** yang diterima.
5. **Disconnect** memanggil API provider (hapus webhook) bila memungkinkan.
6. **Pemetaan field per integrasi** (FR-INT-03 lanjutan): konfigurasi JSON path →
   `name/city/product/dedupeKey/occurredAt` (bukan hanya heuristic `mapLoose`).
7. **Peringatan provider yang tidak mendukung header native** → arahkan ke
   Zapier/Make (sudah ada `integrationGuide`, lanjutkan jadi wizard multi-langkah).

**Tugas implementasi.**

- `apps/api/src/modules/integrations/connectors.ts`: tambah `auth`, `testConnection?`,
  `fields` (mapping), `subscribe/unsubscribe?` pada tipe `Connector`.
- `apps/api/src/modules/integrations/services.ts`: status/health + `verify(provider)`.
- `apps/api/src/modules/integrations/router.ts`: `POST /:id/verify`, `PATCH /:id/config`.
- `packages/db/src/schema.ts`: kolom `status`, `lastCheckedAt`, `lastError`, `externalRef` di `integration`.
- `apps/web/src/features/integrations/`: wizard multi-langkah + indikator status.
- Env OAuth (sudah ada placeholder `HUBSPOT_*`, `SHOPIFY_*`) — isi bila implement OAuth.

**FR:** FR-INT-01/02/03/04.

## B. Targeting UTM / Referrer / Visitor tidak dieksekusi & tanpa UI (FR-NED-07)

**Kondisi saat ini.** `notificationDisplaySchema` punya `countries`, `utm`,
`referrer`. Di runtime hanya **URL match** (`matchUrl`) dan **country**
(`countryAllowed`) yang ditegakkan; `utm` & `referrer` **diabaikan**. Editor
(`notifications-page.tsx`) hanya mengekspos **URL match** — tidak ada UI
UTM/referrer/country/visitor.

**Mengapa belum sesuai.** "Targeting" adalah janji inti (PRD/FR-NED-07). Opsi
yang ada di skema tapi tidak dijalankan = fitur hantu: pengguna mengira bisa
menargetkan, padahal tidak.

**Perilaku yang benar.**

1. Payload mengirim konteks kunjungan: `utm` (query param), `referrer`, `country`,
   dan `visitor` (baru/returning) ke server.
2. Server mengeksekusi aturan: `display.utm` (kecocokan param), `display.referrer`
   (contains/regex), `display.countries` (sudah ada), dan segmentasi visitor.
3. Editor mengekspos field-field itu (UI), divalidasi kontrak.

**Tugas implementasi.**

- `apps/widget/src/loader.ts`: kirim `utm`/`referrer` (dari `location`/`document.referrer`).
- `apps/api/src/modules/widget/services.ts`: fungsi `matchesTargeting(url, utm, referrer, country, visitor)`; buang UTM/referrer yang tak terpakai.
- `apps/web/src/features/notifications/components/notifications-page.tsx`: UI UTM/referrer/country.
- `packages/contracts/src/notifications.ts`: sudah ada — pastikan validasi.

**FR:** FR-NED-07.

## C. Urutan manual: tidak ada UI drag-and-drop (FR-NGS-02)

**Kondisi saat ini.** `loop.manualOrder` kini **dihormati** oleh payload, tetapi
**tidak ada cara mengisinya** dari dashboard (pengaturan hanya punya select
"random|manual"; `manualOrder` selalu `[]`).

**Mengapa belum sesuai.** "Urutan manual" tak bisa dipakai → fitur mati.

**Tugas implementasi.**

- `apps/web/src/features/sites/components/site-settings-dialog.tsx`: daftar
  notifikasi situs dengan **drag-and-drop** yang menulis `loop.manualOrder`,
  atau editor urutan di halaman Notifications.
- Endpoint sudah ada (`PUT /api/v1/sites/:id/settings`), cukup wire UI.

**FR:** FR-NGS-02.

## D. Custom JS belum ada (FR-NGS-04)

**Kondisi saat ini.** Hanya `customCss` (kolom `domain_setting.custom_css`).
Custom **JS** tidak ada.

**Mengapa belum sesuai.** FR-NGS-04 menyebut "Custom CSS/JS".

**Keputusan (dikonfirmasi).** Dukung **Custom JS (sandbox)**.

**Perilaku yang benar.**

1. Kolom `domain_setting.custom_js` (text, nullable).
2. Pixel meng-inject JS **terisolasi**: jalankan di dalam `<iframe sandbox="allow-scripts">`
   tanpa `src` (atau `<script type="module">` di shadow root dengan CSP ketat) —
   tanpa akses ke DOM host, cookie, atau same-origin. Komunikasi ke kartu hanya via
   `postMessage` dengan whitelist tipe pesan.
3. UI memberi peringatan eksplisit ("Advanced — hanya untuk pengguna teknis"),
   validasi panjang, dan dibatasi ke paket Growth+ (gating tipe fitur).
4. Fail-safe: error JS tidak boleh merusak situs host.

**Tugas implementasi.** `schema.ts` (`custom_js`), `sites.ts` kontrak + domain
settings UI (textarea + warning + gating), widget `shadow.ts`/`index.ts` (buat
iframe sandbox + bridge `postMessage`). Jaga `t.js` tetap kecil.

**FR:** FR-NGS-04.

## E. Kuota traffic tidak ditegakkan (FR-BIL-01/03, F51)

**Kondisi saat ini.** `getOverview` **menghitung** pemakaian (kini dari `visit`
event). Namun payload widget **tidak** memblokir/menurunkan apa pun saat
`usage > trafficQuota`. F51 menyebut "batasi payload + ajakan upgrade" — belum ada.

**Mengapa belum sesuai.** Model bisnis freemium berbasis **kuota traffic**: tanpa
penegakan, tier gratis tak termonetisasi.

**Keputusan (dikonfirmasi).** Saat kuota terlampaui: **hentikan seluruh notifikasi**
(tidak ada social proof yang tampil).

**Perilaku yang benar.**

1. Hitung visitor unik per bulan per ORG (Redis counter `visitors:{orgId}:{YYYY-MM}`
   di-increment dari `/widget/v1/visit` dengan dedupe per `visitorId`/hari).
2. Saat kuota terlampaui: `notifications` dikosongkan, payload menandai
   `settings.overQuota = true` (+ `settings.upgradeUrl`), kirim notifikasi email
   ke pemilik org (mis. 80%/100% kuota). Widget **tidak** menampilkan social proof;
   opsional satu bilah kecil "Upgrade untuk mengaktifkan kembali".
3. Tegakkan batas lain: `maxSites` (sudah), `notificationTypes` (sudah).

**Tugas implementasi.**

- `packages/queue/src/index.ts`: counter bulanan orang (`hitVisitor(orgId, visitorId)`).
- `apps/api/src/modules/widget/services.ts`: `overQuota` → kosongkan notifikasi + set `settings.upgrade`.
- `apps/api/src/modules/billing/services.ts`: `getOverview.usage` baca Redis.
- `apps/web/src/features/billing/` + widget: CTA upgrade saat over-quota.

**FR:** FR-BIL-01/03, F51.

## F. Harga paket di UI tidak satu sumber (Billing)

**Kondisi saat ini.** Checkout memakai `STRIPE_PRICE_*` (benar). Tetapi halaman
Billing (`apps/web/src/features/billing/...`) masih **menulis harga hardcoded**
("$12/mo …") — bisa beda dengan Price di Stripe.

**Perilaku yang benar.** Ambil harga/label dari sumber tunggal: Stripe Price
(`unit_amount`) via backend, atau konfigurasi harga yang sama dipakai checkout.

**Tugas implementasi.** `GET /api/v1/billing/plans` (harga dari Stripe) → UI
Billing menampilkan dari API; hapus string harga hardcoded.

**FR:** FR-BIL-01/02.

## G. Review — DIHAPUS dari produk (keputusan 15 Okt 2026)

**Status: fitur dihapus sepenuhnya.** Semula audit ini mengusulkan Review (ulasan/rating
sebagai social proof) dengan sumber Google Maps/Google Business via Places API.
Keputusan produk berubah: **Review tidak dipertahankan sama sekali**.

**Yang dihapus.** Tipe notifikasi `review`, tipe event `review`, kolom mapping
`rating`/`text`, integrasi `google_reviews` (katalog, connector, Place Details API,
refresh terjadwal + endpoint `/:id/refresh`), env `GOOGLE_MAPS_API_KEY`, render review di
`t.js`, opsi tipe di editor, dan test terkait. Enum DB `notification_type`/`event_type`
diperbarui lewat migrasi `0012` (nilai `review` dihapus, baris lama di-purge).

**Implikasi.** Review tidak lagi menjadi bagian parity. Sumber ulasan pihak ketiga
(Judge.me/Loox/Yotpo/Trustpilot) maupun entry manual tetap **di luar scope**.

**FR:** FR-NOT-05 (dibatalkan).

## H. Spin-to-win tanpa reward (F69)

**Kondisi saat ini.** `spin_to_win` hanya animasi roda lalu menampilkan pesan;
tidak ada hadiah/kupon yang benar-benar diberikan.

**Mengapa belum sesuai.** Tujuan conversion widget adalah memberi insentif nyata
(diskon/kupon), bukan sekadar visual.

**Perilaku yang benar.** Konfigurasi hadiah (kode kupon/URL, probabilitas per
segmen), klaim (tampilkan kode / kirim email), dan pencatatan klaim (analytics).
Atau secara jujur dibatasi ke "teaser" dan didokumentasikan.

**Tugas implementasi.** `packages/contracts/src/notifications.ts` (config
`spin: { prizes }`), widget `render/notification.ts` (prizes), event klaim.

**FR:** PRD Fase 4.

## I. Goals: URL-only, tanpa tren/atribusi (FR-ANL-03)

**Kondisi saat ini.** Goal hanya **rule URL**; menampilkan **total** konversi.
Tidak ada deret waktu, tidak ada atribusi ke notifikasi tertentu, tidak ada goal
berbasis event.

**Perilaku yang benar.** Goal event-based (`purchase`/`signup`), tren per hari,
dan **atribusi** (konversi setelah impression notifikasi X dalam jendela waktu).

**Tugas implementasi.** `packages/contracts/src/goals.ts` (rule `{type:"event"}`),
`apps/api/src/modules/goals/services.ts` (agregasi harian + atribusi), UI trend.

**FR:** FR-ANL-03.

## J. Analytics: tak ada breakdown per-notifikasi (FR-ANL-02)

**Kondisi saat ini.** Ringkasan bersifat **site-level** (views/clicks/CTR). A/B
punya breakdown varian, tetapi **tidak ada tabel per-notifikasi** (notifikasi mana
yang performa terbaik).

**Tugas implementasi.** `analytics/services.ts`: agregasi per `refId`
(notificationId) → `variants`-style; UI tabel per-notifikasi.

**FR:** FR-ANL-02.

## K. Events Feed tanpa filter (FR-ING-11)

**Kondisi saat ini.** Sudah **paginasi cursor**, tapi belum ada filter
(type/source/verified) atau pencarian.

**Tugas implementasi.** `eventsFeedQuerySchema` (+`type`,`source`,`verified`) →
`analytics/services.ts` where + UI filter.

**FR:** FR-ING-11.

## L. Editor belum sesuai alur & opsi (FR-NED-01..10) — ✅ DIKERJAKAN

**Kondisi sebelumnya.** Editor satu form (bukan wizard **Type→Track→Display→
Message→Style→Launch**), preview hanya satu bentuk (tak ada device desktop/mobile
nyata), media/ikon (FR-NED-03) **tidak bisa dipilih** (server menurunkan otomatis),
fallback variabel (FR-NED-02) & "sembunyikan time-ago" (FR-NED-04) minim di UI.

**Yang dikerjakan (15 Okt 2026).**

- **Wizard 6 langkah** sesuai PRD §5.1 di `notifications-page.tsx`: stepper
  **Type → Track → Display → Message → Style → Launch** (Type: nama/jenis + extras
  countdown/FOMO/spin; Track: URL match + targeting; Display: posisi, timing,
  media; Message: template + terjemahan + varian A/B; Style: aksen, bentuk,
  ukuran, animasi; Launch: aktif + ringkasan). Navigasi Back/Next, state tidak hilang.
- **Preview device** (desktop/mobile) di `notification-preview.tsx`; menampilkan
  gambar media yang di-pin bila ada.
- **Media eksplisit (FR-NED-03):** `notificationConfig.media = { imageUrl?,
fallback }` — `fallback` ∈ `auto | image | map | gravatar | flag | none`.
  Server `resolveMedia` menghormati pilihan: `imageUrl` yang di-pin menang; selain
  itu hanya sumber yang dipilih yang dipakai (`none` = ikon tipe). Disimpan di
  kolom `extra`; divalidasi kontrak; di-render oleh `t.js` via `mediaUrl`.
- Ditambahkan juga kontrol timing (delay/visible/gap), bentuk/ukuran/animasi yang
  sebelumnya tak terekspos.

**FR:** FR-NED-01..10.

## M. RBAC belum per-role (FR-AUTH-05)

**Kondisi saat ini.** Middleware hanya `requireOrg` (keanggotaan). Tidak ada
pembatasan `owner`/`admin` vs `member` (mis. siapa boleh ubah billing/hapus site).

**Perilaku yang benar.** Cek role dari `member.role` untuk operasi sensitif
(billing, hapus site, undang member).

**Tugas implementasi.** `apps/api/src/modules/auth/middleware.ts` (+`requireRole`),
terapkan di router billing/sites/team.

**FR:** FR-AUTH-05, NFR-SEC-03.

## N. Privasi: `trackIpGeo` tak dipakai & tak ada hapus/ekspor data (NFR-PRIV-02/03)

**Kondisi saat ini.** `storeEmail` sudah dipakai. `trackIpGeo` **inert**; tidak ada
endpoint **hapus/ekspor data** (NFR-PRIV-03).

**Tugas implementasi.** Hormati `trackIpGeo` (atau hapus opsi bila tak dimaksud),
tambah `DELETE /api/v1/sites/:id/events` (atau per event) + ekspor (CSV/JSON).

**FR:** NFR-PRIV-02/03.

## O. Media "map" bergantung layanan eksternal (FR-NED-03)

**Kondisi saat ini.** Fallback peta memakai static-map OpenStreetMap tanpa kunci —
bisa lambat/berubah.

**Perilaku yang benar.** Konfigurasi penyedia peta ber-kunci (opsional) atau
matikan fallback peta.

**Tugas implementasi.** `apps/api/src/modules/widget/services.ts` (`resolveMedia`) +
env opsional.

**FR:** FR-NED-03.

## P. Observability belum memadai (NFR-OBS-01/02)

**Kondisi saat ini.** Logging `console.*`; tak ada endpoint metrik (request rate,
latency, error rate, jobs BullMQ waiting/failed).

**Tugas implementasi.** Logger terstruktur + `GET /metrics` (Prometheus) untuk API
dan worker (BullMQ).

**FR:** NFR-OBS-01/02.

## Q. A/B: tanpa statistik & hanya message (FR-ANL-04)

**Kondisi saat ini.** Variant memilih message/style per visitor; hasil = views/klik/CTR.
Tidak ada signifikansi statistik, tidak ada target konversi, tidak ada editor
style per varian di UI.

**Tugas implementasi.** Editor varian (message+style), indikator signifikansi,
integrasi ke Goals untuk mengukur konversi per varian.

**FR:** FR-ANL-04.

## R. Pemetaan field integrasi masih heuristic (FR-INT-03)

**Kondisi saat ini.** `mapLoose` menebak field via daftar path. Tidak ada mapping
kustom per integrasi.

**Tugas implementasi.** Sertakan `mapping` di `integration.config` (JSON path →
field) dan pakai di `mapToEvent`.

**FR:** FR-INT-03.

---

### Ringkasan prioritas perbaikan

| Prioritas | Temuan                                          | Dampak                          |
| --------- | ----------------------------------------------- | ------------------------------- |
| P0        | A Integrasi connect, E Kuota traffic            | Nilai inti & monetisasi         |
| P1        | B Targeting, C Manual order, D Custom JS        | Fitur yang dijanjikan tapi mati |
| P2        | F Harga, I Goals, J Analytics per-notif, M RBAC | Kepercayaan & keamanan          |
| P3        | K,L,N,O,P,Q,R — ✅ semua dikerjakan             | Penyempurnaan                   |
| —         | ~~G Review~~ — DIHAPUS dari produk              | —                               |

> Setiap item di atas harus menambah: bentuk data baru → skema Zod di
> `@repo/contracts`; error baru → `apiErrorSchema`; query difilter
> `organizationId`/`siteId`; migrasi `db:generate`→review→`db:deploy`; test; gate
> `pnpm check && pnpm typecheck`.

---

# Referensi Kompetitor & Rencana Parity (WiserNotify · ProveSource)

> **Metode (diperbarui 15 Okt 2026).** Analisis kini berdasarkan **eksplorasi
> langsung di dalam dashboard ber-login** kedua platform
> (`app.wisernotify.com` — akun `ziyadanil2108`; `console.provesrc.com` — akun
> `mubakal0`), bukan lagi hanya halaman marketing publik. Alur editor, langkah
> wizard, opsi targeting, kontrol data/timing, katalog integrasi, dan struktur
> navigasi diverifikasi dari UI nyata. Bagian **"Alur proses bisnis nyata"** di
> bawah adalah hasil verifikasi itu dan menjadi acuan agar implementasi Tacto
> meniru **alur**-nya (duplikat + modifikasi), bukan sekadar nama fitur.
>
> Catatan: beberapa layar di balik paywall (mis. wizard _Connect_ integrasi di
> WiserNotify tier gratis, aturan display lanjutan ProveSource di langkah
> _Customize_) hanya terlihat sebagian; ditandai eksplisit di bawah. Angka &
> fitur bisa berubah; verifikasi ulang saat implementasi.

## Alur proses bisnis nyata (terverifikasi in-app · 15 Okt 2026)

> Tujuan subbab ini: memetakan **alur kerja sebenarnya** di WiserNotify &
> ProveSource ke implementasi Tacto, supaya fitur Tacto mengikuti proses bisnis
> yang terbukti — bukan hanya meng-expose field. Setiap alur menyebut **sumber
> fakta → perilaku nyata → implikasi untuk Tacto**.

### 1. Model editor notifikasi — WiserNotify = editor ber-tab, ProveSource = wizard linear

**WiserNotify (fakta in-app).** Editor **bukan satu form**, melainkan editor
ber-tab dengan tombol **Back / Next / Pause**:

- Grup **Design**: `Display` · `Data source` · `Text Editor` · `Click actions` ·
  `Position & animation` · `Style` · `Embed code`
- Tab terpisah: **`Data control`** · **`Timing control`** · **`Verify label`**

**ProveSource (fakta in-app).** **Wizard linear 6 langkah** (langkah terkunci
sampai langkah sebelumnya valid): **`Type → Track → Display → Message →
Customize → Launch`**.

**Implikasi Tacto (koreksi audit L / FR-NED-01..10).** Wizard Tacto
`Type→Track→Display→Message→Style→Launch` sudah sejalan **ProveSource**. Tetapi
tambahkan dua "tab lanjutan" ala WiserNotify yang hari ini belum ada sebagai
langkah eksplisit: **Data control** (jendela data, jumlah record, _skip seen_,
_cap per halaman_) dan **Timing control** (delay/durasi/jeda/randomize). Keduanya
di Tacto masih tersebar di `timing`/`dataSource` tanpa UI setara — lihat alur #3.

### 2. Targeting — WiserNotify meng-expose penuh di tab Display

**WiserNotify (fakta in-app, tab `Display`).** Opsi nyata:

- **Where to display**: `All pages` / `Pages when URL condition matches`
  (+`Use absolute URLs`) / **`Display on multiple websites`**.
- **Target Audience** (panel eksplisit): **Visitor · Country · UTMs · Cookies &
  Referrer**.

**ProveSource (fakta in-app, langkah `Display`).** Lebih sederhana di wizard:
`Use Absolute URLs` (abaikan http/www/param) + URL match (`Simple/Contains/Regex/
All Pages`) + **`Exclude from pages`** + catatan "bisa pakai JavaScript atau
inline embed". Targeting geo/device/visitor ProveSource ada di pengaturan
lanjutan (sebagian di balik langkah Customize — tidak sepenuhnya terlihat).

**Implikasi Tacto (koreksi audit B / FR-NED-07 & T3).** Target yang terbukti
dipakai pesaing: **URL match + exclude pages + Country + UTM + Referrer +
Cookies + Visitor (baru/returning) + multi-site**. Ini yang harus **dieksekusi
di runtime + punya UI**, bukan sekadar ada di skema. Prioritaskan `exclude from
pages` (ProveSource) dan panel `Target Audience` (WiserNotify) sebagai bentuk UI.

### 3. Sequencing / frekuensi — ada di "Data control" + "Timing control" WiserNotify

**WiserNotify (fakta in-app).**

- **Tab `Data control`**: `Display data from the last N days` · `Display records
(last 15)` · **`Skip seen data` + `Set time duration` (mis. 1 jam)** ·
  **`Set max data limit to display per page`**.
- **Tab `Timing control`**: `Initial delay` · `Display notification time`
  (durasi) · `Apply fix delay between two notifications` · `Randomize delay`.
- **Global per-domain (Settings)**: Loop & Close (loop jika > N, pause X hari,
  selalu tampil ikon close), Notification order (random / drag-manual +
  prioritas negara), Custom code & CSS, Privacy & GDPR, passthrough analytics,
  Others (profanity, duplicate, block IP, country-specific).

**Implikasi Tacto (koreksi audit C/T4 — "show once/skip repeats/cap").** Fitur
yang di parity ditandai "WiserNotify ✅, Tacto ❌" **terbukti** berbentuk:
`skipSeen{durationHrs}` + `maxPerPage` (per-notifikasi, di Data control) — **bukan**
sekadar "once per session" global. Implementasikan di `timing`/`dataControl`
notifikasi + eksekusi di `t.js` (localStorage per-visitor untuk _skip seen_).

### 4. Sumber data (Track) — kuncinya integrasi + auto-capture + webhook

**ProveSource (fakta in-app, langkah `Track`).** "What events would you like to
capture?" → **Form Submissions · Webhook · Product Purchase** (terikat integrasi:
**Wix Events, Thinkific Events, Stripe Purchases**, dst) + "Where to capture"
(URL match) + "Check captured submissions". Jadi **sumber event = per-notifikasi**,
dipilih di wizard.

**WiserNotify (fakta in-app, tab `Data source`).** Pilih integrasi sebagai sumber

- **data filtering** (kondisi untuk memfilter data yang tampil).

**Implikasi Tacto (FR-ING / audit A).** Model yang benar: **sumber event dipilih
per-notifikasi** (bukan hanya global), dengan filter data. Tacto `dataSource`
sudah ada; tambahkan UI "pilih sumber + filter" setara, dan di Track tampilkan
"cek submission terakhir" (bukti data benar masuk).

### 5. Integrasi "Connect" — katalog besar; ProveSource bahkan outsourcing review

**WiserNotify (fakta in-app).** Katalog **200+** integrasi berkategori
(Marketing, Page builder, Platform, CRM, Reviews, Communication, Booking,
Billing, Custom, Social) termasuk **Custom Webhooks, Zapier, Make, Pabbly,
Stripe, Shopify, WooCommerce/WordPress, dan puluhan sumber review** (Google,
Yelp, Trustpilot-sejenis, Judge.me via konektor, dll). Alur _Connect_ aktual
berada **di balik paywall** pada akun gratis (tidak bisa diverifikasi penuh),
tetapi kategorisasi + "Installed (0)" + health menegaskan model lifecycle.

**ProveSource (fakta in-app).** **Review widgets = produk partner eksternal
(Shapo)** — tautan keluar, **bukan native**. **Conversion widgets (Boost)** =
popups, spin-to-win, announcement bars, countdown timers (produk kedua).

**Implikasi Tacto (audit A/T1 & G/T2).** (a) Model integrasi harus
lifecycle-lengkap (authorize → verify → health → disconnect) seperti audit A —
tetap P0. (b) Karena **ProveSource saja meng-outsource review widget**, membangun
**sumber Review native di Tacto (manual + moderasi)** adalah **diferensiasi yang
masuk akal**, bukan sekadar parity. Lihat pertanyaan konfirmasi di akhir.

### 6. Conversion widgets & analytics

**ProveSource.** Navigasi: `Review widgets` · `Conversion widgets` ·
`Notifications` · `Events Feed` · `Goals` · `Analytics`. Spin-to-win ada sebagai
bagian **Boost** (conversion widget), konsisten dengan rencana T11 Tacto (hadiah
spin nyata). **WiserNotify** menonjolkan A/B Test per-notifikasi (tombol **A/B
Test** di daftar) + analytics per-notifikasi.

**Implikasi Tacto.** Pertahankan T7 (analytics per-notifikasi), T9 (A/B ≤5
varian), T11 (spin reward). Semua terbukti ada di pesaing.

## Perbandingan kapabilitas

| Kapabilitas                                    | WiserNotify      | ProveSource | Tacto sekarang          | Aksi    |
| ---------------------------------------------- | ---------------- | ----------- | ----------------------- | ------- |
| Recent sales / stream                          | ✅               | ✅          | ✅ `recent_sales`       | ok      |
| Sign-up / lead pop                             | ✅               | ✅          | ✅ (dataSource)         | ok      |
| Counter / Combo (24h/7/30d)                    | ✅               | ✅          | ✅ counter/combo        | ok      |
| Live visitors                                  | ✅               | ✅          | ✅                      | ok      |
| Reviews & rating pop                           | ✅ (Google/FB)   | ✅ (multi)  | ⚠️ tanpa sumber         | **T2**  |
| Informational / Custom                         | ✅               | ✅          | ✅                      | ok      |
| Social counter (followers/likes)               | ✅               | ✅          | ❌ (enum reserved)      | **T6**  |
| Countdown timer (widget/bar)                   | ✅               | ✅          | ✅ countdown/bar        | ok      |
| Announcement bar                               | ✅               | ✅          | ✅ bar                  | ok      |
| Inline embeds (badge/counter di halaman)       | ✅               | ⚠️          | ❌                      | **T6**  |
| Low-stock / FOMO                               | ⚠️               | ⚠️          | ✅ low_stock            | ok      |
| Popup / Spin-to-win                            | ❌/⚠️            | ✅ (Boost)  | ✅ (spin visual only)   | **T11** |
| WhatsApp button / AI builder                   | ❌               | ✅          | ❌                      | pending |
| Targeting URL                                  | ✅               | ✅          | ✅                      | ok      |
| Targeting country                              | ✅               | ✅          | ✅ (header geo)         | ok      |
| Targeting city / language                      | ✅               | ✅          | ❌                      | **T3**  |
| Targeting device / screen-size                 | ✅               | ✅ (mobile) | ❌                      | **T3**  |
| Targeting UTM / referrer / visitor             | ✅ (behavior)    | ✅          | ⚠️ skema, tak jalan     | **T3**  |
| Order / loop / random                          | ✅               | ✅          | ✅                      | ok      |
| Show once per session / skip repeats / cap     | ✅               | ✅          | ❌                      | **T4**  |
| Max conversions / anonymous / hide location    | ⚠️               | ✅          | ❌                      | **T4**  |
| Include/exclude produk                         | ⚠️               | ✅          | ❌                      | **T4**  |
| All-time-high (jika event sedikit)             | ❌               | ✅          | ✅ combo                | ok      |
| Custom CSS                                     | ✅ (Pro+)        | ✅          | ✅                      | ok      |
| Custom JS (sandbox)                            | ⚠️               | ⚠️          | ❌                      | **T5**  |
| RTL / auto-inherit font situs                  | ✅/⚠️            | ✅          | ❌                      | **T10** |
| A/B multivariate + signifikansi + auto-promote | ✅ (≤5 varian)   | ✅          | ⚠️ minimal              | **T9**  |
| Analytics: impression/klik/CTR                 | ✅               | ✅          | ✅                      | ok      |
| Analytics: hover/engaged visitor               | ⚠️               | ✅          | ❌                      | **T7**  |
| Analytics: compare period, top pages/devices   | ✅               | ✅          | ❌                      | **T7**  |
| Analytics: per-notifikasi                      | ✅               | ✅          | ❌                      | **T7**  |
| Revenue attribution / ROAS / goal revenue      | ✅ (Shopify/Woo) | ✅          | ❌                      | **T8**  |
| Weekly digest email / export GA/BI             | ✅               | ✅          | ⚠️ passthrough saja     | **T7**  |
| 100–200+ integrasi (native + Zapier)           | ✅ (200+)        | ✅ (100+)   | ⚠️ 44, connect kasar    | **T1**  |
| Auto-detect platform e-commerce                | ✅               | ✅          | ❌                      | pending |
| Review import (Google/FB/Trustpilot/Yotpo)     | ✅               | ✅          | ❌ (FB/Google batal)    | **T2**  |
| Free plan                                      | ❌ (trial 7h)    | ✅          | ✅                      | —       |
| Harga                                          | dari $16/bln     | free + paid | $12/$35/$79             | **T13** |
| Multi-site unlimited                           | ✅               | per paket   | per paket               | —       |
| Kuota traffic ditegakkan                       | ✅               | ✅          | ❌ (hitung saja)        | **T12** |
| Onboarding "live < 5 menit" + AI preview URL   | ✅               | ✅          | ✅ checklist (tanpa AI) | pending |

## Rencana parity (task)

| #      | Task                                                                                                                                     | Prioritas | FR              |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------- | --------- | --------------- |
| T1     | Integrasi connect sesungguhnya (OAuth/webhook/poll, verify, health, mapping, disconnect) = audit **A**                                   | P0        | FR-INT-01..04   |
| T12    | Tegakkan kuota traffic: hentikan notifikasi saat over-quota + CTA/email = audit **E**                                                    | P0        | FR-BIL-01/03    |
| ~~T2~~ | ~~Sumber Review & rating~~ — **DIHAPUS** (Review keluar dari produk)                                                                     | —         | —               |
| T3     | Targeting lengkap: UTM/referrer/visitor + country/city/language + device                                                                 | P1        | FR-NED-07       |
| T4     | Sequencing & custom rules: once/session, skip repeats, frequency cap, max conversions, anonymous, hide location/product, include-exclude | P1        | FR-NGS-02/03/07 |
| T5     | Custom JS sandbox = audit **D**                                                                                                          | P1        | FR-NGS-04       |
| T6     | Inline embeds + Social counter (tipe notifikasi baru)                                                                                    | P1        | FR-NOT-08/09    |
| T7     | Analytics dalam: per-notifikasi, hover/engaged, compare period, top pages/devices/countries, export                                      | P2        | FR-ANL-02       |
| T8     | Revenue attribution / goal revenue / ROAS                                                                                                | P2        | FR-ANL-03       |
| T9     | A/B: ≤5 varian, signifikansi, auto-promote                                                                                               | P2        | FR-ANL-04       |
| T10    | Lokalisasi UI (daftar bahasa, RTL), FE0 inheritance font                                                                                 | P2        | FR-NED-12       |
| T13    | Harga satu sumber (Stripe Price) = audit **F**                                                                                           | P2        | FR-BIL-01/02    |
| T11    | Conversion widgets: hadiah spin nyata, WhatsApp button, announcement presets                                                             | P3        | PRD Fase 4      |
| —      | Auto-detect platform e-commerce; AI preview URL; weekly digest email                                                                     | P3        | backlog         |

## Keputusan adopsi

- **Diadopsi (parity wajib):** T1, T12, T2, T3, T4, T5, T6, T7.
- **Diadopsi bertahap:** T8, T9, T10, T13, T11.
- **Ditunda/opsional:** WhatsApp button, AI widget builder/preview, auto-detect platform, weekly digest, RTL (bergantung permintaan pasar Asia/global).
- **Tetap ditolak (beda posisi produk):** mesin testimonial/Wall of Love, Slack/Teams, notifikasi fiktif. Import review **Facebook/YouTube** tetap di luar scope.
- **Diputuskan 15 Okt 2026 (revisi):** **fitur Review DIHAPUS dari produk.** Tipe notifikasi `review`, tipe event `review`, dan integrasi Google Places (`google_reviews`) dikeluarkan — lihat audit **G**. Sumber ulasan pihak ketiga dan entry manual juga di luar scope.

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

## Fase 16 — UI undang anggota ✅

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

## Fase 20 — Panel Install snippet + origin guard ✅

> **File:** `apps/web/src/features/sites/components/install-panel.tsx`; `apps/api/src/modules/widget/` (`assertAllowedOrigin`).
> **Kerjakan:** snippet `<script src="{WIDGET_CDN_URL}/t.js" data-site>` + GTM; origin check domain.
> **Cek:** domain asing ditolak. **FR:** FR-SITE-02/03/06, NFR-SEC-05.

## Fase 21 — Verifikasi pixel terpasang (API ✅)

> **File:** `apps/api/src/modules/widget/services.ts`, web.
> **Kerjakan:** set `pixelVerifiedAt` saat payload pertama; badge status + "Cek ulang".
> **Cek:** pasang snippet → Verified. **FR:** FR-SITE-05.

---

# EPIK D — Widget runtime (`apps/widget` → `t.js`)

## Fase 22 — Scaffold `apps/widget` (Vite lib, no React) ✅

> **File:** `apps/widget/{package.json,vite.config.ts,tsconfig.json,src/index.ts}`.
> **Kerjakan:** Vite `lib` IIFE → `t.js`; depend hanya `@repo/contracts`. **Cek:** build → `dist/t.js`. **FR:** NFR-PERF-01.

## Fase 23 — Loader: baca `data-site` + fetch payload (fail-safe) ✅

> **File:** `apps/widget/src/{index.ts,loader.ts}`. **Kerjakan:** fetch `/widget/v1/payload` dibungkus try/catch.
> **Cek:** API mati → situs host normal. **FR:** NFR-REL-02.

## Fase 24 — Shadow DOM host + CSS terisolasi ✅

> **File:** `apps/widget/src/shadow.ts`. **Cek:** style tidak bocor. **FR:** SRS §3.4, NFR-A11Y-01.

## Fase 25 — Render kartu notifikasi ✅

> **File:** `apps/widget/src/render/notification.ts`. **Kerjakan:** kartu ikon/fakta/timeAgo + baris Verified; meniru `.livecard` style guide.
> **Cek:** payload dummy → kartu sesuai posisi/accent. **FR:** FR-NOT-01..04.

## Fase 26 — Scheduler: delay/durasi/interval/loop/urutan/close ✅

> **File:** `apps/widget/src/scheduler.ts`. **Kerjakan:** timing + loop + urutan + close (localStorage jeda X hari); hormati `prefers-reduced-motion`.
> **Cek:** urutan/loop/close sesuai. **FR:** FR-NED-09, FR-NGS-01/02/03.

## Fase 27 — Beacon track + auto-capture form ✅

> **File:** `apps/widget/src/{track.ts,capture.ts}`. **Kerjakan:** `sendBeacon` view/click; listener submit → `/widget/v1/capture` (URL match).
> **Cek:** klik→click; submit→capture. Bundle `t.js` < 30 KB gzip. **FR:** FR-ANL-01, FR-ING-01/05.

---

# EPIK E — Mesin notifikasi

## Fase 28 — Service + Router Notifications (CRUD) ✅

> **File:** `apps/api/src/modules/notifications/{services.ts,router.ts}`, `app.ts`.
> **Kerjakan:** CRUD `/api/v1/notifications` per `siteId`; body `notificationConfigSchema`; tenant guard; toggle `isActive`.
> **Cek:** buat tersimpan; inactive tak ikut payload. **FR:** FR-NED-11.

## Fase 29 — Endpoint payload publik + cache Redis ✅ (cache Redis menyusul)

> **File:** `apps/api/src/modules/widget/{router.ts,services.ts}`.
> **Kerjakan:** pilih notifikasi aktif cocok `url` → `widgetPayloadResponseSchema` + `ttl` + cache Redis.
> **Cek:** panggilan kedua dari cache; p95 < 150 ms. **FR:** NFR-PERF-02/03.

## Fase 30 — Resolver template variabel + fallback ✅

> **File:** `apps/api/src/modules/widget/template.ts`. **Kerjakan:** `renderMessage(template,vars,fallbacks)` + trim/kapitalisasi + time-ago>N→recently; nama depan + kota saja.
> **Cek:** unit test. **FR:** FR-NED-01/02/04, NFR-PRIV-01.

## Fase 31 — Tipe: Recent Sales ✅

> **File:** `.../widget/sources/recent-sales.ts`. **Kerjakan:** `event` terbaru sesuai dataSource → widgetNotification. **FR:** FR-NOT-01.

## Fase 32 — Tipe: Counter ✅ (worker + Redis cache)

> **File:** `apps/worker/src/processors/counter-recompute.ts`, `packages/queue/src/index.ts` (`createRealtimeStore`), `apps/api/src/modules/widget/services.ts`.
> **Kerjakan:** worker mengagregasi event/periode tiap tipe `counter`/`combo` per site → Redis `counter:{notificationId}` (TTL 60s); widget membaca cache, backfill dari DB saat miss. **FR:** FR-NOT-02, FR-ANL-05.

## Fase 33 — Tipe: Live Visitors ✅ (Redis ZSET)

> **File:** `packages/queue/src/index.ts` (`recordVisit`/`countVisitors`), `apps/api/src/modules/widget/`, `apps/widget/src/track.ts`.
> **Kerjakan:** beacon view → `ZADD tacto:live-visitors:{siteId}` (member = `visitorId` stable per-browser, fallback IP) + window 5 menit; payload membaca `ZCOUNT`. **Cek:** 2 visitor → ≥2. **FR:** FR-NOT-03.

## Fase 34 — Tipe: Custom/Informational ✅

> **File:** `.../widget/sources/custom.ts`. **Kerjakan:** teks/CTA statis. **Cek:** "garansi 30 hari" tampil. **FR:** FR-NOT-04.

## Fase 35 — Editor notifikasi (web) ✅

> **File:** `apps/web/src/features/notifications/` (`components/editor/*`, `hooks/use-notifications.ts`).
> **Kerjakan:** wizard **Type→Track→Display→Message→Style→Launch**; media fallback (image→icon→map→gravatar→flag).
> **Cek:** panel tersimpan & tervalidasi. **FR:** FR-NED-01..08.

## Fase 36 — Preview real-time ✅

> **File:** `.../notifications/components/preview.tsx`. **Kerjakan:** preview desktop/mobile dari state editor. **FR:** FR-NED-10.

## Fase 37 — Tipe: Review ✅

> **File:** `.../widget/sources/review.ts`. **Kerjakan:** sumber review dari **event review / integrasi import** (bukan testimonial engine). **FR:** FR-NOT-05 (S).

---

# EPIK F — Ingestion event

## Fase 38 — API key per site ✅

> **File:** `schema.ts` (field/tabel key), `apps/api/src/modules/ingest/auth.ts`. **Cek:** tanpa key → 401. **FR:** FR-ING-02.

## Fase 39 — Ingest manual + idempotency + anonimisasi ✅

> **File:** `apps/api/src/modules/ingest/{router.ts,services.ts}`, `contracts/events.ts`.
> **Kerjakan:** `POST /ingest/v1/event` → `event`; dedupeKey unique → 409; simpan displayName(nama depan)+city.
> **Cek:** 2× dedupe → 1 tersimpan. **FR:** FR-ING-02/06/07.

## Fase 40 — Endpoint capture (auto form submit) ✅

> **File:** `apps/api/src/modules/widget/router.ts` (`/widget/v1/capture`). **Kerjakan:** URL match → `event(form_submit, pixel)`.
> **Cek:** submit host → event. **FR:** FR-ING-01/05.

## Fase 41 — Rate-limit ingest ✅ (in-memory; Redis multi-instance menyusul)

> **File:** `apps/api/src/modules/ingest/rate-limit.ts` (Redis). **Cek:** flood → 429. **FR:** NFR-SEC-04, FR-VER-03.

## Fase 42 — Webhook + signature ✅ (proses sinkron; enqueue BullMQ = F43 menyusul)

> **File:** `apps/api/src/modules/ingest/webhook.ts`. **Kerjakan:** verifikasi signature → `webhookQueue.add` → 202.
> **Cek:** signature salah → 401. **FR:** FR-ING-03/04.

## Fase 43 — Worker webhook → event ✅

> **File:** `apps/worker/src/processors/webhook.ts`, `apps/api/src/modules/ingest/services.ts`, `packages/contracts/src/jobs.ts`.
> **Kerjakan:** API verifikasi signature + map via konektor → `webhookQueue.add({provider,siteId,receivedAt,event})` → 202; worker menulis `event` terverifikasi (`source=provider`), idempoten via `dedupeKey`, lalu enqueue recompute counter. Peta payload dipindah ke job ter-normalisasi; fallback sinkron bila queue tak dikonfigurasi (test).
> **Cek:** signature salah → 401; job → `event` → notifikasi. **FR:** FR-ING-03, FR-VER-01.

---

# EPIK G — Integrasi (framework)

## Fase 44 — Framework konektor generik ✅

> **Hasil:** satu abstraksi konektor: `auth → poll/webhook → map ke Event`.
> **File:** `apps/api/src/modules/integrations/{services.ts,router.ts}`, `packages/contracts/src/integrations.ts`.
> **Kerjakan:** definisikan interface konektor (`id`, `verifySignature?`, `mapToEvent(raw)→IngestEvent`); registry provider; CRUD `integration` per org; webhook (F42) & manual (F39) memakai konektor sesuai `provider`. Webhook generik ("custom") sebagai konektor default.
> **Cek:** integrasi "custom webhook" terdaftar → event masuk via konektornya. **FR:** FR-INT-01 (MVP).

## Fase 45 — Katalog integrasi (UI) ✅

> **File:** `apps/web/src/features/integrations/`. **Kerjakan:** daftar provider, connect/disconnect, status.
> **Cek:** connect custom webhook dari UI. **FR:** FR-INT-02/03/04 (Fase 2).

---

# EPIK H — Analytics & Goals

## Fase 46 — Tulis impression (hot-path Redis) ✅

> **File:** `apps/api/src/modules/widget/router.ts` + `services.ts` (`/widget/v1/track`), `packages/queue/src/index.ts`.
> **Kerjakan:** validasi `trackEventSchema` → `store.pushImpression` (RPUSH `tacto:analytics:impressions`); view juga `recordVisit` live window. Fallback insert DB bila store tak ada.
> **Cek:** track cepat; buffer bertambah. **FR:** FR-ANL-01.

## Fase 47 — Flush analytics + tabel `goal` ✅

> **File:** `apps/worker/src/processors/analytics-aggregate.ts` (+ `worker.ts`), `schema.ts` (+`goal`, migrasi).
> **Kerjakan:** worker menjadwalkan flush berkala (`upsertJobScheduler`, 5 dtk) → drain buffer Redis (`LRANGE`+`LTRIM`) → insert `impression`; entri site terhapus di-drop. Tabel `goal` dipakai penuh di Fase 2.
> **Cek:** impression muncul di Postgres. **FR:** FR-ANL-05 (+ANL-03 dasar).

## Fase 48 — Endpoint ringkasan analytics ✅

> **File:** `apps/api/src/modules/analytics/{services.ts,router.ts}`. **Kerjakan:** `GET /api/v1/analytics?from&to` → impression/klik/CTR (tenant-filtered).
> **Cek:** angka cocok. **FR:** FR-ANL-02.

## Fase 49 — Dashboard analytics + Events Feed ✅

> **File:** `apps/web/src/features/analytics/`. **Kerjakan:** stat tile (tabular) + grafik (skill `dataviz`) + Events Feed (log event masuk).
> **Cek:** laporan 7 hari; dark/light. **FR:** FR-ANL-02, FR-ING-11.

---

# EPIK I — Billing freemium

## Fase 50 — Definisi plan & limit ✅ (kontrak di F11)

> **File:** `packages/contracts/src/billing.ts`. **Kerjakan:** map plan → `{trafficQuota,maxSites,removeBadge,notificationTypes}` + helper. **FR:** FR-BIL-01.

## Fase 51 — Penegakan batas (maxSites) ✅

> **File:** `apps/api/src/modules/billing/guard.ts`. **Kerjakan:** cek `maxSites` saat buat Site; visitor bulan (Redis) vs `trafficQuota` → batasi payload + ajakan upgrade.
> **Cek:** Free Site ke-2 ditolak. **FR:** FR-BIL-03.

## Fase 52 — Badge "Powered by Tacto" ✅

> **File:** payload (`showBadge`) + `apps/widget/src/render/badge.ts`. **Kerjakan:** `showBadge = plan==="free"`.
> **Cek:** Free tampil badge. **FR:** FR-BIL-04.

## Fase 53 — Halaman billing (status plan) ✅

> **File:** `apps/web/src/features/billing/`. **Kerjakan:** plan, kuota terpakai, batas; CTA upgrade (Stripe di Fase 2).
> **Cek:** status akurat. **FR:** FR-BIL-01/03.

---

# EPIK J — Onboarding & Acceptance MVP

## Fase 54 — Onboarding checklist ✅

> **File:** `apps/web/src/features/onboarding/`. **Kerjakan:** buat Site → pasang pixel → verifikasi → notifikasi pertama (state dari data nyata).
> **Cek:** user baru dibimbing. **FR:** PRD §3.2/§3.3.

## Fase 55 — Verified label + anti-abuse ✅

> **File:** widget badge verified + rate-limit (F41). **Kerjakan:** hanya event terverifikasi ber-✓.
> **Cek:** event non-verified tak ber-✓. **FR:** FR-VER-03.

## Fase 56 — E2E alur MVP ✅ (HTTP e2e widget + integrasi pglite per modul; browser E2E butuh stack hidup)

> **File:** `apps/web/e2e/*` / skrip integrasi. **Kerjakan:** sign-up → Site → snippet → verifikasi → 4 tipe notifikasi tampil hanya di domain terdaftar & sesuai URL → capture + webhook → loop/order/close → analytics → batas Free + badge.
> **Cek:** skenario hijau. **FR:** SRS §9.

## Fase 57 — Konfigurasi deployment ✅ (compose redis/worker/proxy + Caddyfile; belum diuji-runtime)

> **File:** `docker-compose.yaml`, `Dockerfile`. **Kerjakan:** `docker compose up` (postgres/redis/api/worker/proxy); proxy serve `t.js` + SPA; migrasi saat start api.
> **Cek:** 9 kriteria MVP SRS §9 terpenuhi. **FR:** SRS §8/§9.

**→ Exit MVP: bisa dipasang & dijual (PRD §10).**

---

# EPIK K+ — Fase 2–4 (ringkas, code-level per task)

### Fase 2 — transaksi nyata & konversi

- **F58** OAuth Google ✅ + reset password via email ✅ (SMTP) — FR-AUTH-04/06
- **F59** Stripe checkout + webhook status langganan. ✅ (checkout butuh STRIPE_SECRET_KEY; webhook update plan teruji) — FR-BIL-02/05
- **F60** Konektor Stripe/Shopify/WooCommerce (purchase→event verified) via framework F44. ✅ — FR-ING-09, FR-VER-01/02
- **F61** Zapier/Make ✅ (lewat ingest API key + konektor "zapier" + UI Integrations). — FR-ING-08, FR-INT-04
- **F62** Import review — **DIREVISI (15 Okt 2026): Google Maps/Business diaktifkan** (Places API ≤5 review+cache, dan/atau Business Profile API OAuth); **Facebook/YouTube tetap dibatalkan**. Tipe Review (F37) juga tetap bisa via webhook/ingest/manual. — FR-ING-10, FR-NOT-05
- **F63** Goals ✅ (konversi URL + stats + UI) + **A/B testing varian ✅** (variants per-notifikasi, bucketing deterministik per visitor, breakdown views/klik/CTR di Analytics + editor varian). — FR-ANL-03/04
- **F64** Katalog integrasi UI + data filtering per-integrasi ✅ — FR-INT-02/03
- **F65** Custom CSS + domain settings UI + passthrough GA/GTM/FB/Mixpanel ✅ — FR-NGS-01..06

### Fase 3 — suite lengkap

- **F66** Tipe: Combo ✅, Low stock (FOMO) ✅, Countdown ✅ (Social/YouTube dilewati — integrasi tak dipakai). — FR-NOT-06/07
- **F67** Privacy/anti-abuse: block IP ✅ + profanity filter ✅ + **country display ✅** (geo dari header CDN `cf-ipcountry`/`x-vercel-ip-country`; fail-open bila tak diketahui) + **cegah duplikat ✅** (dedupeKey) + **terjemahan template ✅** (FR-NED-12, template per-locale). — FR-NGS-07, FR-NED-12
- **F68** Katalog integrasi diperluas ✅ — 44 provider (e-commerce, pembayaran, form/CRM, kursus, komunitas) via framework konektor generik + signature toleran (Lihat EPIK G). — FR-INT-02

### Fase 4 — ekspansi

- **F69** Conversion widgets ✅ (popup, notification bar, spin-to-win): tipe notifikasi baru, posisi `center`/`top-bar`/`bottom-bar`, render di `t.js`, editor + preview, gating per paket. — PRD Fase 4
- **F70** Optimisasi performa/biaya ✅ (inti): rate-limit Redis multi-instance + endpoint metrik aktivasi + onboarding "First notification shown" & time-to-activation. — FR-NGS/PRD §3.3

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
