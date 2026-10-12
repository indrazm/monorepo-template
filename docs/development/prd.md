# PRD — Tacto

**Product Requirements Document**
Versi: 3.0 (global) · Tanggal: 10 Oktober 2026 · Status: Draft
Perubahan dari v2.0: **finalisasi keputusan arsitektur & stack** ke monorepo (pnpm workspaces + Hono + Drizzle + Better Auth + BullMQ/Redis + TanStack Router SPA + shadcn/ui). Scope produk (dua mesin: notifikasi + testimonial) tidak berubah.
Dokumen pendamping: SRS-Tacto.md (v3), Analisis-Validasi-Tacto.md, Tacto-Feature-Teardown.md

---

## 1. Ringkasan Eksekutif

**Tacto** adalah platform _social proof_ global yang membantu brand, agensi, dan pelaku bisnis online **menaikkan konversi penjualan** dengan menampilkan bukti aktivitas & kepuasan pelanggan di website dan landing page mereka.

Tacto meniru kategori yang sudah terbukti laku secara global (WiserNotify, ProveSource, Nudgify, Fomo, Senja) lalu memodifikasinya dengan **menyatukan dua kemampuan yang hari ini terpisah**:

1. **Mesin notifikasi social proof** (seperti WiserNotify/ProveSource) — sales pop, counter, visitor, review, dsb.
2. **Mesin testimonial/review** (seperti Senja) — kumpulkan, kelola, dan ubah testimonial jadi aset (Wall of Love, widget, gambar).

Pemain besar kuat di salah satu sisi saja: WiserNotify/ProveSource kuat di notifikasi tapi lemah di testimonial; Senja kuat di testimonial tapi bukan notifikasi. **Tacto = keduanya dalam satu produk & satu langganan** — itu positioning utamanya. Nilai tambah kepercayaan: **verified/ethical proof** (notifikasi hanya dari event nyata).

Posisi inti: _bukan_ menjual "widget", melainkan menjual **kenaikan konversi** — ROI yang jelas sehingga mudah dibayar.

---

## 2. Latar Belakang & Masalah

### 2.1 Masalah yang diselesaikan

- Pengunjung ragu membeli karena tidak ada bukti bahwa orang lain sudah membeli & puas.
- Bukti pelanggan (testimonial, review, aktivitas pembelian) berserakan dan tidak ditampilkan secara meyakinkan.
- Bisnis yang ingin keduanya (notifikasi real-time + testimonial) hari ini harus berlangganan **dua tool berbeda** (mis. WiserNotify + Senja) → biaya & kerumitan ganda.

### 2.2 Peluang pasar (ringkas)

- Kategori terbukti besar & aktif: WiserNotify 20.000+ situs & 200+ integrasi; Nudgify 3.100–4.000 brand di 138 negara; Senja ~$800K ARR dengan 3.000+ pelanggan; Fomo ~$1M ARR.
- Dampak konversi terdokumentasi: testimonial +34%; produk dengan ≥5 review 270% lebih mungkin dibeli; notifikasi real-time +10–15% (konservatif). Detail & sumber di Analisis-Validasi-Tacto.md.
- Harga pasar: model **kuota traffic** (visitor/bulan), umumnya $9–$65/bln.

### 2.3 Realita kompetitif (karena global)

Memilih global = head-to-head dengan pemain matang & murah. Meniru fitur saja tidak cukup; Tacto butuh sudut berbeda. Sudut terpilih: **all-in-one (notifikasi + testimonial) satu harga + verified proof.**

---

## 3. Visi Produk & Tujuan

### 3.1 Visi

> Menjadi satu platform tempat bisnis membangun kepercayaan dan menaikkan konversi — menyatukan notifikasi social proof dan testimonial, dengan bukti yang asli & terverifikasi.

### 3.2 Tujuan bisnis (12 bulan pertama)

| Tujuan                                         | Target                   |
| ---------------------------------------------- | ------------------------ |
| Pelanggan berbayar                             | 300 akun                 |
| MRR                                            | $6.000                   |
| Konversi free → paid                           | ≥ 3%                     |
| Churn bulanan                                  | ≤ 5%                     |
| Waktu pasang pixel & tampil notifikasi pertama | ≤ 10 menit tanpa ngoding |

### 3.3 Metrik keberhasilan produk

- **Aktivasi:** % akun yang memasang pixel & menampilkan ≥1 notifikasi/widget dalam 24 jam.
- **Nilai terbukti:** % pelanggan melihat laporan impression/klik dalam 7 hari.
- **Adopsi dua sisi:** % pelanggan yang memakai notifikasi _dan_ testimonial (ukuran utama diferensiasi all-in-one).
- **Retensi:** % pelanggan aktif setelah 3 bulan.
- **Viral loop:** signup dari badge "Powered by Tacto" (tier gratis).

---

## 4. Target Pengguna (Persona)

### 4.1 Beachhead

**Pemilik toko online kecil-menengah (D2C/e-commerce) & solopreneur/creator (coach, kursus, SaaS kecil)** — mereka paling butuh dua-duanya (notifikasi pembelian + testimonial), aktif di komunitas global berbahasa Inggris, dan paham value tool konversi.

### 4.2 Persona utama

1. **Toko online (Shopify/WooCommerce/custom)** — ingin sales pop, stok, visitor counter + Wall of Love.
2. **Creator/coach/penjual kursus** — ingin testimonial funnel + review display + signup counter.
3. **SaaS kecil & startup** — ingin "recent signups", review, Wall of Love di landing.
4. **Agensi / CRO** — kelola banyak situs klien (multi-site), potensi upsell tinggi.

### 4.3 Pengguna sekunder

- **Pengunjung situs pelanggan** (end-visitor) — melihat notifikasi/widget; UX mereka menentukan dampak konversi.

---

## 5. Lingkup Produk (Scope)

### 5.1 Tiga pilar

**Pilar A — Mesin notifikasi social proof** (meniru WiserNotify/ProveSource)
**Pilar B — Mesin testimonial/review** (meniru Senja)
**Pilar C — Fondasi SaaS** (multi-situs, integrasi, analytics, billing, onboarding)

### 5.2 Fitur per pilar

**A. Notifikasi**

- Tipe (v1): Recent Sales (sales pop), Sales/Lead Counter, Live Visitors, Review, Custom/Informational.
- Editor mendalam: Text (variabel `{{nama}}`, `{{produk}}`, `{{time_ago}}` + fallback), Style, Position & animation, Display/targeting, Data source, Timing.
- Preview device (desktop/mobile).
- Pengaturan global per domain: loop, urutan (acak/manual), close, custom CSS, consent GDPR.
- Tambahan (fase lanjut): FOMO/scarcity (low stock, countdown), Social counter, YouTube, Combo.

**B. Testimonial**

- **Form funnel multi-langkah** (meniru Senja): rating → **sentiment routing** (puas→testimonial publik, tidak puas→feedback privat) → pertanyaan kustom → **consent** → about you (+foto) → thank you.
- (Opsional kuat) **reward/insentif** untuk naikkan response rate.
- Manage/moderasi (approve/reject/hide), tag, import manual.
- Output "Studio": **Wall of Love, Widget embed, Image kartu**, (fase lanjut) Video, Case study, Rich Snippet SEO.
- Metrik form: invites, visits, testimonials, response rate; URL form publik.

**C. Fondasi**

- Auth + organisasi + multi-situs (siteKey, validasi domain).
- Pixel/JS universal + snippet GTM; onboarding checklist + verifikasi pixel.
- Data in: **Custom Webhook + Zapier + pixel event + auto-capture form submission**; integrasi Stripe/Shopify/WooCommerce (fase 2).
- Analytics (impression, klik, CTR, goals).
- Billing freemium **berbasis kuota traffic**; badge "Powered by Tacto" di tier gratis.

### 5.3 Prioritas (MoSCoW)

| Fitur                                                                   | Prioritas | Fase   |
| ----------------------------------------------------------------------- | --------- | ------ |
| Auth + org + multi-site                                                 | Must      | MVP    |
| Pixel universal + verifikasi + onboarding                               | Must      | MVP    |
| Notifikasi: Sales pop, Counter, Live Visitors, Custom                   | Must      | MVP    |
| Editor notifikasi (text/style/position/display/timing) + preview device | Must      | MVP    |
| Pengaturan global (loop/order/close/CSS/consent)                        | Must      | MVP    |
| Data in: pixel event + Custom Webhook + auto-capture form               | Must      | MVP    |
| Testimonial funnel (rating→routing→consent→about→thanks)                | Must      | MVP    |
| Moderasi testimonial + Wall of Love + widget + image                    | Must      | MVP    |
| Analytics dasar + Goals                                                 | Must      | MVP    |
| Freemium + badge + kuota traffic                                        | Must      | MVP    |
| Zapier + Stripe + Shopify + WooCommerce                                 | Should    | Fase 2 |
| Review import (Google/Facebook) + Review nudge                          | Should    | Fase 2 |
| A/B testing & goal tracking                                             | Should    | Fase 2 |
| Reward/insentif testimonial                                             | Should    | Fase 2 |
| Automasi auto-minta testimonial (trigger pembelian)                     | Should    | Fase 2 |
| FOMO/scarcity, Social counter, YouTube, Combo                           | Could     | Fase 3 |
| Video testimonial, Case study, Rich Snippet, "Use with AI"              | Could     | Fase 3 |
| Conversion widgets (popup, spin-to-win, bar, countdown)                 | Could     | Fase 3 |
| Katalog integrasi diperluas (Make/Pabbly/CRM/course)                    | Could     | Fase 3 |

### 5.4 Di luar lingkup (v1)

- Aplikasi mobile native.
- Notifikasi palsu/fiktif (dilarang — bertentangan dengan positioning verified).
- Integrasi Slack/Teams (produk lain).

---

## 6. User Stories (inti)

- Sebagai **pemilik toko**, saya ingin memasang satu pixel agar notifikasi & widget muncul tanpa ngoding.
- Sebagai **pemilik toko**, saya ingin notifikasi "baru saja dibeli" otomatis dari event nyata (pixel/webhook/Stripe) agar terpercaya.
- Sebagai **creator**, saya ingin mengirim link form agar pelanggan mengisi testimonial, dengan pelanggan tidak puas diarahkan ke feedback privat.
- Sebagai **creator**, saya ingin menampilkan testimonial sebagai Wall of Love & kartu gambar untuk medsos.
- Sebagai **agensi**, saya ingin mengelola banyak situs klien dalam satu akun.
- Sebagai **pemilik bisnis**, saya ingin satu tool untuk notifikasi _dan_ testimonial agar tak bayar dua langganan.
- Sebagai **pengunjung**, saya ingin melihat bukti jujur & terverifikasi agar yakin membeli.

---

## 7. Model Bisnis & Harga

### 7.1 Model

Freemium + langganan bulanan/tahunan, **berbasis kuota traffic (visitor/bulan)** — pola standar pasar (WiserNotify, dll). Tier gratis menampilkan badge "Powered by Tacto".

### 7.2 Struktur paket (indikatif, USD)

| Paket   | Harga/bln | Kuota           | Batasan utama                                           |
| ------- | --------- | --------------- | ------------------------------------------------------- |
| Free    | $0        | ~1–2K visitor   | 1 situs, badge Tacto, tipe terbatas                     |
| Starter | ~$15      | 10K visitor     | hapus badge, semua tipe notif, testimonial funnel       |
| Growth  | ~$39      | 50–100K visitor | 3 situs, A/B testing, custom CSS, integrasi, 1 teammate |
| Agency  | ~$89      | 200K+ visitor   | 10+ situs, multi-klien, teammates, inline               |

> Semua paket sudah termasuk **notifikasi + testimonial** (diferensiasi all-in-one). Harga final divalidasi lewat uji pasar.

---

## 8. Diferensiasi & Moat

1. **All-in-one (notifikasi + testimonial) satu harga** — pelanggan tak perlu dua tool. Sudut utama.
2. **Verified/ethical proof** — notifikasi hanya dari event nyata + label terverifikasi (didukung data: 56% batal beli jika curiga palsu).
3. **Kesederhanaan & onboarding cepat** — menyerang keluhan umum (UI rumit, harga melonjak saat traffic besar).
4. **Suite bertahap** — mudah menambah conversion widgets (popup/spin-to-win) seperti arah ProveSource "Boost".

> Catatan jujur: moat ini lebih tipis daripada moat lokal di v1. Keunggulan harus dijaga lewat eksekusi, kecepatan, dan kualitas onboarding, bukan sekadar daftar fitur.

---

## 9. Asumsi & Risiko

| Risiko                                                                             | Dampak                      | Mitigasi                                                                                              |
| ---------------------------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------- |
| Pasar global sangat kompetitif & murah                                             | Sulit menonjol              | Positioning all-in-one + onboarding superior                                                          |
| Membangun 2 mesin sekaligus = lingkup besar                                        | MVP molor                   | Fokus MVP tipis tiap pilar; integrasi via webhook generik dulu                                        |
| Integrasi tak pernah selesai                                                       | Beban rawat                 | Bangun framework webhook/Zapier dulu, bukan 200 konektor                                              |
| Kebiasaan "maunya gratis"                                                          | Konversi rendah             | Tier gratis bernilai + bukti ROI cepat                                                                |
| Notifikasi palsu merusak kepercayaan                                               | Churn                       | Prinsip verified-only sejak awal                                                                      |
| Stack baru (Hono/Drizzle/Better Auth/BullMQ) & tooling frontier (TS, oxlint/oxfmt) | Learning curve, rough edges | Monorepo template matang sebagai basis; jaga kontrak tipe lewat `@repo/contracts` & module boundaries |

---

## 10. Roadmap & Milestone

| Fase                  | Fokus                                                                              | Hasil                                                         |
| --------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **MVP (bln 1–3)**     | Pixel + notifikasi inti + testimonial funnel + Wall of Love + freemium             | Bisa dijual ke pelanggan pertama                              |
| **Fase 2 (bln 3–6)**  | Stripe/Shopify/WooCommerce + Zapier + review import + A/B test + reward + automasi | Notifikasi dari transaksi nyata, naikkan konversi testimonial |
| **Fase 3 (bln 6–12)** | FOMO/scarcity, social/YouTube, video testimonial, Rich Snippet, conversion widgets | Suite lengkap, ekspansi tipe & upsell                         |
| **Fase 4 (12 bln+)**  | "Use with AI", katalog integrasi luas, optimisasi                                  | Naikkan ARPU & retensi                                        |

---

## 11. Catatan Teknis (ringkas)

**Arsitektur: monorepo (pnpm workspaces).** Satu repo, banyak surface yang berbagi kontrak tipe — dipilih karena produk banyak bersinggungan dengan API, integrasi, dan worker, serta lebih aman saat scale.

**Stack inti:**

- **Package manager & build:** pnpm (workspaces + catalog), Vite; lint/format via oxlint + oxfmt (Oxc); TypeScript; test via Vitest.
- **Frontend dashboard (`apps/web`):** React + **TanStack Router** (SPA) + **shadcn/ui** (`@repo/ui`), state server via TanStack Query.
- **Backend API (`apps/api`):** **Hono** — melayani endpoint publik widget (`/widget/*`), form publik (`/form/*`), ingestion (`/ingest/*`), dan API dashboard (`/api/v1/*`). Type-safe end-to-end ke dashboard lewat **Hono RPC** (`@repo/api-client`).
- **Auth:** **Better Auth** (email/password, sesi, OAuth Google, reset password) + **organization plugin** untuk multi-tenant (Org, undang user, role).
- **Worker (`apps/worker`):** **BullMQ** — webhook, agregasi analytics, kalkulasi counter/goal, automasi trigger.
- **ORM & DB:** **Drizzle ORM** + **PostgreSQL** (multi-tenant). Migrasi via drizzle-kit.
- **Cache & queue:** **Redis** — backing BullMQ, cache payload widget, counter live-visitors.
- **Kontrak bersama (`packages/contracts`):** skema **Zod** sebagai satu sumber kebenaran (validasi API, form, payload job).
- **Deploy:** **Docker Compose** (postgres, redis, api, worker, proxy). Pixel/widget (`t.js`) & dashboard SPA diserve statik via proxy/CDN. Opsional: dashboard di-deploy ke Cloudflare.

**Kunci teknis:** widget script ringan & fail-safe (≤30 KB, async); endpoint widget cacheable di edge (Hono); ingestion event real-time (pixel/webhook); privasi/GDPR (consent, tampil nama depan + kota); arsitektur multi-tenant yang menampung dua mesin (notifikasi + testimonial). Detail lengkap di SRS-Tacto.md (v3).
