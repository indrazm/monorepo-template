# PRD — Tacto

**Product Requirements Document**
Versi: 4.0 (notifications-only, monorepo) · Tanggal: 12 Oktober 2026 · Status: Draft
Perubahan dari v3.0: **stack diselaraskan ke monorepo** (Hono API + TanStack Router SPA + Drizzle + Better Auth + BullMQ/Redis), **scope tetap notifications-only** (mesin testimonial tetap di luar produk). Mengikuti model WiserNotify, ProveSource, Nudgify, Fomo.
Dokumen pendamping: SRS-Tacto.md (v4), Analisis-Validasi-Tacto.md, Tacto-Feature-Teardown.md

---

## 1. Ringkasan Eksekutif

**Tacto** adalah platform _social proof notification_ global yang membantu brand, agensi, dan bisnis online **menaikkan konversi** dengan menampilkan notifikasi real-time di website mereka — pembelian terbaru, jumlah pengunjung, review, counter, dan pesan kustom.

Tacto meniru kategori yang sudah terbukti laku (WiserNotify, ProveSource, Nudgify, Fomo) lalu memodifikasinya lewat tiga hal: **onboarding & UX lebih sederhana**, **harga lebih jelas**, dan **verified/ethical proof** (notifikasi hanya dari event nyata). Fokus produk sempit dan dalam: satu hal — notifikasi social proof — dikerjakan sangat baik.

Posisi inti: _bukan_ menjual "widget", melainkan menjual **kenaikan konversi** — ROI jelas sehingga mudah dibayar.

> Keputusan ruang lingkup: **tanpa mesin testimonial/Wall of Love** (itu produk tersendiri seperti Senja). Tacto adalah pemain di ruang notifikasi, bersaing langsung dengan WiserNotify/ProveSource.

---

## 2. Latar Belakang & Masalah

### 2.1 Masalah yang diselesaikan

- Pengunjung ragu membeli karena tidak ada bukti orang lain sudah membeli & puas.
- Bisnis punya data aktivitas (pembelian, signup, kunjungan) tapi tidak menampilkannya sebagai bukti yang meyakinkan di situs.
- Memasang bukti sosial manual itu teknis; bisnis butuh cara tanpa ngoding.

### 2.2 Peluang pasar (ringkas)

- Kategori terbukti besar & aktif: WiserNotify 20.000+ situs & 200+ integrasi; Nudgify 3.100–4.000 brand di 138 negara; Fomo ~$1M ARR.
- Dampak konversi terdokumentasi: notifikasi real-time +10–15% (konservatif); popup social proof ~+15%. Detail & sumber di Analisis-Validasi-Tacto.md.
- Harga pasar: model **kuota traffic** (visitor/bulan), umumnya $9–$65/bln.

### 2.3 Realita kompetitif

Pasar global ini kompetitif & murah. Meniru fitur saja tidak cukup; Tacto menang lewat **kesederhanaan + kecepatan onboarding + verified proof**, bukan daftar fitur terpanjang.

---

## 3. Visi Produk & Tujuan

### 3.1 Visi

> Cara tercepat & terpercaya bagi bisnis untuk menampilkan bukti sosial nyata di website dan menaikkan konversi — tanpa ngoding.

### 3.2 Tujuan bisnis (12 bulan pertama)

| Tujuan                                         | Target                   |
| ---------------------------------------------- | ------------------------ |
| Pelanggan berbayar                             | 300 akun                 |
| MRR                                            | $6.000                   |
| Konversi free → paid                           | ≥ 3%                     |
| Churn bulanan                                  | ≤ 5%                     |
| Waktu pasang pixel → notifikasi pertama tampil | ≤ 10 menit tanpa ngoding |

### 3.3 Metrik keberhasilan produk

- **Aktivasi:** % akun yang memasang pixel & menampilkan ≥1 notifikasi dalam 24 jam.
- **Nilai terbukti:** % pelanggan melihat laporan impression/klik (atau goal) dalam 7 hari.
- **Retensi:** % pelanggan aktif setelah 3 bulan.
- **Viral loop:** signup dari badge "Powered by Tacto" (tier gratis).

---

## 4. Target Pengguna (Persona)

### 4.1 Beachhead

**Pemilik toko online kecil-menengah (D2C/e-commerce)** — paling sering memakai sales pop & langsung merasakan dampak ke penjualan.

### 4.2 Persona utama

1. **Toko online (Shopify/WooCommerce/custom)** — ingin sales pop, stok, visitor counter.
2. **SaaS kecil / creator / coach** — ingin "recent signups", counter, review display.
3. **Agensi / CRO** — kelola banyak situs klien (multi-site), upsell tinggi.

### 4.3 Pengguna sekunder

- **Pengunjung situs pelanggan** (end-visitor) — melihat notifikasi; UX mereka menentukan dampak konversi.

---

## 5. Lingkup Produk (Scope)

### 5.1 Fitur inti

**Mesin notifikasi** (meniru WiserNotify/ProveSource):

1. **Tipe notifikasi** — Sales pop (recent sales), Counter (sales/lead/visit over period), Live visitors, Review, Custom/Informational.
2. **Editor** — alur Type → Track (data source) → Display (targeting) → Message (teks + variabel) → Style/Position → Launch; preview desktop/mobile.
3. **Targeting** — URL match (All/Simple/Contains/Regex), Visitor/Country/UTM/Referrer.
4. **Pengaturan global per domain** — loop, urutan (acak/manual), close, custom CSS, consent GDPR.
5. **Data masuk** — pixel auto-capture form submission + Custom Webhook + integrasi.
6. **Analytics & Goals** — impression, klik, CTR, goal tracking; Events Feed.
7. **Verified/ethical proof** — tandai event dari sumber nyata; label "✓ Verified".

**Fondasi SaaS** — auth, organisasi, multi-situs, pixel universal, onboarding checklist + verifikasi pixel, billing freemium (kuota traffic), badge "Powered by Tacto".

### 5.2 Integrasi (bagian penting — user minta disertakan)

Pendekatan bertahap, mulai dari yang paling berdampak:

- **Universal (MVP):** pixel/JS, auto-capture form submission, **Custom Webhook**, Google Tag Manager.
- **Fase 2:** **Zapier & Make** (membuka ratusan app sekaligus lewat 1 integrasi), **Stripe**, **Shopify**, **WooCommerce**.
- **Fase 3:** review sources (Google, Facebook), e-commerce lain (BigCommerce, Wix), CRM/forms/course (HubSpot, Typeform, Kajabi), dsb.

> Prinsip: jangan kejar 200 konektor di awal. **Webhook + Zapier/Make** menutup mayoritas kebutuhan dengan usaha jauh lebih kecil.

### 5.3 Prioritas (MoSCoW)

| Fitur                                                           | Prioritas | Fase       |
| --------------------------------------------------------------- | --------- | ---------- |
| Auth + org + multi-site                                         | Must      | MVP        |
| Pixel universal + verifikasi + onboarding checklist             | Must      | MVP        |
| Tipe: Sales pop, Counter, Live visitors, Custom                 | Must      | MVP        |
| Editor (Type/Track/Display/Message/Style) + preview device      | Must      | MVP        |
| Targeting URL + Visitor/Country/UTM/Referrer                    | Must      | MVP        |
| Pengaturan global (loop/order/close/CSS/consent)                | Must      | MVP        |
| Data in: pixel auto-capture + Custom Webhook                    | Must      | MVP        |
| Analytics dasar (impression/klik/CTR)                           | Must      | MVP        |
| Freemium + badge + kuota traffic                                | Must      | MVP        |
| Tipe: Review                                                    | Should    | MVP/Fase 2 |
| Zapier/Make + Stripe + Shopify + WooCommerce                    | Should    | Fase 2     |
| Goals & A/B testing                                             | Should    | Fase 2     |
| Verified label                                                  | Should    | Fase 2     |
| Review import (Google/Facebook)                                 | Should    | Fase 2     |
| Tipe: Combo, Social counter, YouTube, FOMO/low-stock, Countdown | Could     | Fase 3     |
| Katalog integrasi diperluas                                     | Could     | Fase 3     |
| Conversion widgets (popup, spin-to-win, bar) — arah "Boost"     | Could     | Fase 4     |

### 5.4 Di luar lingkup

- **Mesin testimonial/Wall of Love/form funnel** (produk terpisah — tidak dibuat).
- Aplikasi mobile native.
- Notifikasi palsu/fiktif (dilarang — bertentangan dengan verified proof).
- Slack/Teams.

---

## 6. User Stories (inti)

- Sebagai **pemilik toko**, saya ingin memasang satu pixel agar notifikasi muncul tanpa ngoding.
- Sebagai **pemilik toko**, saya ingin sales pop otomatis dari pembelian nyata (pixel/webhook/Stripe) agar terpercaya.
- Sebagai **pemilik toko**, saya ingin mengatur notifikasi hanya tampil di halaman produk tertentu.
- Sebagai **SaaS**, saya ingin menampilkan "X orang mendaftar minggu ini" (counter).
- Sebagai **agensi**, saya ingin mengelola banyak situs klien dalam satu akun.
- Sebagai **pemilik bisnis**, saya ingin melihat berapa kali notifikasi tampil & diklik (dan dampaknya ke goal).
- Sebagai **pengunjung**, saya ingin melihat bukti jujur & terverifikasi agar yakin membeli.

---

## 7. Model Bisnis & Harga

### 7.1 Model

Freemium + langganan bulanan/tahunan, **berbasis kuota traffic (visitor/bulan)**. Tier gratis menampilkan badge "Powered by Tacto".

### 7.2 Struktur paket (indikatif, USD)

| Paket   | Harga/bln | Kuota           | Batasan utama                                      |
| ------- | --------- | --------------- | -------------------------------------------------- |
| Free    | $0        | ~1–2K visitor   | 1 situs, badge Tacto, tipe terbatas                |
| Starter | ~$12      | 10K visitor     | hapus badge, semua tipe notif                      |
| Growth  | ~$35      | 50–100K visitor | 3 situs, A/B testing, custom CSS, integrasi, goals |
| Agency  | ~$79      | 200K+ visitor   | 10+ situs, multi-klien, teammates                  |

> Harga final divalidasi lewat uji pasar.

---

## 8. Diferensiasi & Moat

1. **Kesederhanaan & onboarding cepat** — menyerang keluhan umum (UI rumit, kurva belajar). Target: notifikasi tampil < 10 menit.
2. **Verified/ethical proof** — notifikasi hanya dari event nyata + label terverifikasi (didukung data: 56% batal beli jika curiga palsu).
3. **Harga jelas** — tidak melonjak diam-diam saat traffic naik; batas transparan.

> Catatan jujur: di ruang yang matang & murah ini, moat tipis. Keunggulan dijaga lewat eksekusi, kecepatan, dukungan, dan kualitas onboarding — bukan jumlah fitur.

---

## 9. Asumsi & Risiko

| Risiko                               | Dampak          | Mitigasi                                          |
| ------------------------------------ | --------------- | ------------------------------------------------- |
| Pasar kompetitif & murah             | Sulit menonjol  | Onboarding superior + verified proof              |
| Integrasi tak pernah selesai         | Beban rawat     | Webhook + Zapier/Make dulu, bukan 200 konektor    |
| Kebiasaan "maunya gratis"            | Konversi rendah | Tier gratis bernilai + bukti ROI cepat            |
| Notifikasi palsu merusak kepercayaan | Churn           | Prinsip verified-only sejak awal                  |
| Komoditisasi fitur                   | Harga tertekan  | Fokus niche/segmen & kualitas, bukan perang fitur |

---

## 10. Roadmap & Milestone

| Fase                 | Fokus                                                                                        | Hasil                                         |
| -------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **MVP (bln 1–2)**    | Pixel + 4 tipe notifikasi + editor + targeting + webhook/auto-capture + analytics + freemium | Bisa dipasang & dijual                        |
| **Fase 2 (bln 2–4)** | Zapier/Make + Stripe/Shopify/WooCommerce + Goals + A/B test + Review + verified label        | Notifikasi dari transaksi nyata, bukti dampak |
| **Fase 3 (bln 4–8)** | Tipe tambahan (Combo/Social/YouTube/FOMO/Countdown) + katalog integrasi luas                 | Paritas fitur dengan incumbent                |
| **Fase 4 (8 bln+)**  | Conversion widgets (popup/spin-to-win/bar), optimisasi                                       | Ekspansi & upsell                             |

---

## 11. Catatan Teknis (ringkas)

**Arsitektur: monorepo (pnpm workspaces).** Satu repo, banyak surface yang berbagi kontrak tipe lewat `packages/contracts` (Zod).

**Stack inti:**

- **Package manager & build:** pnpm (workspaces + catalog), Vite; lint/format via oxlint + oxfmt (Oxc); TypeScript; test via Vitest.
- **Frontend dashboard (`apps/web`):** React + **TanStack Router** (SPA) + **shadcn/ui** (`@repo/ui`), state server via TanStack Query.
- **Backend API (`apps/api`):** **Hono** — endpoint publik widget (`/widget/*`), ingestion (`/ingest/*`), dan API dashboard (`/api/v1/*`). Type-safe end-to-end ke dashboard lewat **Hono RPC** (`@repo/api-client`).
- **Auth:** **Better Auth** (email/password, sesi, OAuth Google, reset password) + **organization plugin** (Org, undang user, role).
- **Worker (`apps/worker`):** **BullMQ** — webhook, agregasi analytics, kalkulasi counter/goal.
- **ORM & DB:** **Drizzle ORM** + **PostgreSQL** (multi-tenant); migrasi via drizzle-kit.
- **Cache & queue:** **Redis** — backing BullMQ, cache payload widget, counter live-visitors.
- **Pixel (`apps/widget`):** bundle `t.js` vanilla JS (Vite lib, ≤30 KB, no React).
- **Deploy:** **Docker Compose** (postgres, redis, api, worker, proxy). Pixel/widget & SPA diserve statik via proxy/CDN; opsional dashboard di-deploy ke Cloudflare.

Kunci teknis: widget script ringan (≤30 KB) & fail-safe; endpoint widget cacheable; ingestion event real-time (pixel/webhook); targeting & timing; privasi/GDPR (consent, tampil nama depan + kota); multi-tenant. Detail lengkap di SRS-Tacto.md (v4).
