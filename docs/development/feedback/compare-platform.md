# Review & Feedback Platform Tacto

**Tanggal review:** 17 Oktober 2026
**Yang di-review:** `app.tacto.software` (platform Tacto milik Anda)
**Pembanding:** WiserNotify (`app.wisernotify.com`) & ProveSource (`console.provesrc.com`) — termasuk fitur berbayar
**Acuan tujuan:** PRD-Tacto v4, SRS-Tacto v3/v4, Tacto Brand Guidelines
**Metode:** login langsung ke ketiga platform, menelusuri setiap menu, membuat site uji (`hrgrowth.id`) & menelusuri editor notifikasi end-to-end, memeriksa jaringan/console untuk memverifikasi apakah pipeline benar-benar bekerja.

---

## 0. Ringkasan Eksekutif (baca ini dulu)

Secara **tampilan dan struktur fitur**, Tacto sudah mengejutkan: alur, menu, dan konsep sudah sangat mirip dengan WiserNotify/ProveSource, dan beberapa bagian (pengaturan per-domain, katalog integrasi) bahkan cukup lengkap. Fondasinya bagus.

**Tetapi secara fungsional, Tacto saat ini BELUM benar-benar "jadi" / belum bisa dipakai pelanggan nyata.** Ada tiga temuan _blocker_ yang membuat value proposition inti produk (pasang pixel → notifikasi muncul di website) **tidak mungkin berjalan** untuk pelanggan mana pun:

| #      | Temuan Blocker                                                                                | Dampak                                                                                                          |
| ------ | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **B1** | **Snippet pixel menunjuk ke `http://localhost:8080/t.js`**                                    | Tidak ada satu pun pelanggan yang bisa menampilkan notifikasi. Snippet ini hanya "jalan" di komputer developer. |
| **B2** | **Backend API berjalan di tunnel ngrok gratis** (`celena-draughtiest-marylee.ngrok-free.dev`) | Bukan infrastruktur produksi — lambat, bisa mati kapan saja, tergantung komputer dev menyala.                   |
| **B3** | **Endpoint ingest integrasi juga menunjuk ke ngrok**                                          | Semua integrasi (Stripe, Shopify, webhook, dll.) akan mengarah ke tunnel dev yang sama.                         |

Artinya: fitur-fitur di dalamnya sudah ada, tapi **"kabel" ke dunia luar belum tersambung**. Ini bukan masalah fitur — ini masalah _deployment_. Harus diselesaikan **sebelum** apa pun yang lain, karena tanpa ini Tacto tidak bisa didemokan apalagi dijual.

Setelah itu, prioritas berikutnya adalah menutup gap di **editor notifikasi (data source), analytics, support/onboarding, dan beberapa bug UX** agar setara dengan kompetitor.

**Skor kesiapan kasar:** Fondasi UI/fitur ~70% · Kesiapan produksi ~15% · Kesiapan jual ~10%.

---

## 1. Temuan Kritis (Blocker) — WAJIB diperbaiki lebih dulu

### B1 — Snippet pixel menunjuk ke `localhost` 🔴

Di **Sites → Install**, snippet yang diberikan ke pelanggan adalah:

```html
<script src="http://localhost:8080/t.js" data-site="rnj2od4ha4..." async></script>
```

Masalahnya:

1. **`localhost:8080`** = komputer pengunjung itu sendiri, bukan CDN Tacto. Di website pelanggan mana pun, file ini tidak akan ketemu → notifikasi tidak pernah tampil.
2. **`http://`** (bukan `https://`) = _mixed content_. Browser akan memblokir skrip HTTP di halaman HTTPS (hampir semua website sekarang HTTPS).
3. SRS Anda sendiri menetapkan `https://cdn.tacto.io/t.js` + env `WIDGET_CDN_URL`. Nilai ini jelas nilai dev yang belum pernah di-set untuk produksi.

**Konsekuensi langsung:** status "Pixel not detected" tidak akan pernah berubah jadi verified, karena pixel memang tidak pernah bisa dimuat di site nyata. Seluruh rantai (pixel → impression → notifikasi → analytics) putus di langkah pertama.

### B2 — Backend di tunnel ngrok gratis 🔴

Semua request dashboard pergi ke `https://celena-draughtiest-marylee.ngrok-free.dev/api/v1/...`. Ini **ngrok free tunnel**, yang berarti:

- URL berubah/mati setiap tunnel di-restart; ada halaman interstitial & rate-limit ngrok.
- Hanya hidup selama komputer dev menyala dan menjalankan ngrok.
- **Lambat** — halaman Billing butuh beberapa detik hanya untuk memuat daftar paket ("Loading plans…"), karena latensi tunnel.
- Tidak ada SLA, tidak bisa di-scale, tidak sesuai NFR (uptime ≥99,5%, p95 <150ms) di SRS Anda.

### B3 — Endpoint ingest integrasi juga ngrok 🔴

Di **Integrations → Stripe (dan lainnya)**, endpoint server-to-server yang ditampilkan:

```
https://celena-draughtiest-marylee.ngrok-free.dev/ingest/v1/event
```

Jadi meskipun pelanggan berhasil memasang webhook Stripe/Shopify, datanya dikirim ke tunnel dev. Sama tidak-produksinya.

> **Kesimpulan bagian ini:** Tacto perlu **di-deploy sungguhan** (sesuai Bab 8 SRS: Docker Compose — app, db, worker, proxy, + CDN untuk `t.js`) dengan domain & env produksi (`WIDGET_CDN_URL`, `APP_URL`, `DATABASE_URL`, dll.) sebelum langkah lain punya arti. Ini bukan opsional.

---

## 2. Bug & Masalah UX (High)

### U1 — Gagal buat site "diam-diam", tanpa pesan error 🟠

Saat membuat site:

- Domain `demostore.example.com` → ditolak **400 `validation_error`**, modal **tidak menampilkan pesan apa pun**, hanya diam. Ironisnya, placeholder di form itu sendiri adalah `shop.example.com` — contoh yang kalau diikuti justru **ditolak** validator.
- Domain dengan `https://` (mis. `https://demostore.com`) → juga ditolak, karena tidak ada normalisasi input (protokol tidak di-strip).
- Domain valid (`demostore.com`, `hrgrowth.id`) → berhasil (201).

**Masalah UX nyata:** user yang menempel `https://tokoku.com` atau memakai contoh di placeholder akan dapat kegagalan tanpa tahu kenapa. Tidak ada field-level error, tidak ada normalisasi. Validator backend mengembalikan error generik, dan frontend tidak menampilkannya sama sekali.

### U2 — Label langkah editor notifikasi tidak cocok dengan isinya 🟠

Wizard punya 6 langkah: **1 Type · 2 Track · 3 Display · 4 Message · 5 Style · 6 Launch**. Tapi isinya tertukar:

- Langkah **"2 Track"** → isinya **targeting** (Show on / Who sees this / Countries / Referrer / UTM) — ini seharusnya "Display".
- Langkah **"3 Display"** → isinya **posisi, timing, media** — ini seharusnya "Style".
- **Tidak ada langkah "Track" (data source) yang sebenarnya.** Padahal di SRS (FR-NED-08) "Track" = pilih sumber event + filter data.

Akibatnya: **tidak ada cara memilih event mana yang memberi makan sebuah notifikasi, atau memfilternya per-notifikasi.** Di kompetitor, ini justru jantung editor (lihat §3). Minimal, label langkah harus dibenahi agar tidak membingungkan; idealnya, tambahkan langkah data-source yang sesungguhnya.

### U3 — Halaman Billing lambat memuat paket 🟠

"Upgrade" menampilkan "Loading plans…" selama beberapa detik sebelum paket muncul (karena B2/ngrok). Ini halaman uang — kesan pertama buruk & bisa bikin user kira fitur rusak.

---

## 3. Analisis per-Area (Tacto vs Kompetitor)

### 3.1 Onboarding & Pemasangan Pixel

| Aspek                                         | Tacto                                           | WiserNotify                                    | ProveSource               |
| --------------------------------------------- | ----------------------------------------------- | ---------------------------------------------- | ------------------------- |
| Checklist onboarding                          | ✅ 4 langkah                                    | ✅ 4 langkah                                   | ✅ guided setup wizard    |
| Panduan per-platform (Shopify/WP/Webflow/GTM) | ❌ hanya 1 snippet + sebut GTM                  | ✅ banyak panduan per-CMS + deteksi tech stack | ✅ panduan + guided setup |
| Verifikasi pixel                              | ⚠️ otomatis saja, tak ada tombol "cek sekarang" | ✅ tombol "Verify pixel installation"          | ✅ + **Debug Mode**       |
| Mode uji/test di site                         | ❌                                              | ✅                                             | ✅ Debug Mode             |

**Gap:** Tacto hanya memberi satu snippet mentah. Dua kompetitor memberi panduan spesifik per-platform, deteksi tech-stack, tombol verifikasi eksplisit, dan mode debug.

### 3.2 Tipe Notifikasi

Tipe yang **ada di UI Tacto:** Recent sales, Counter, Combo (30-day), Live visitors, Low stock (FOMO), Countdown, Custom, **Popup**, **Notification bar**, **Spin to win**.

| Tipe                                              | Tacto                   | WiserNotify              | ProveSource           |
| ------------------------------------------------- | ----------------------- | ------------------------ | --------------------- |
| Recent sales / Stream                             | ✅                      | ✅                       | ✅                    |
| Counter / Combo                                   | ✅                      | ✅                       | ✅                    |
| Live visitors                                     | ✅                      | ✅                       | ✅                    |
| Custom / Informational                            | ✅                      | ✅                       | ✅                    |
| **Reviews** (Google/FB)                           | ❌ (enum ada, UI tidak) | ✅ Review + Review Count | ✅ Reviews            |
| **Social counter**                                | ❌ (enum ada, UI tidak) | ✅                       | ✅ Social Counter     |
| **YouTube stats**                                 | ❌                      | ✅                       | —                     |
| Low stock / Countdown                             | ✅                      | ✅ (urgency widgets)     | ✅ (conversion)       |
| Conversion (Popup/Bar/Spin)                       | ✅ sudah ada            | ✅                       | ✅ Conversion widgets |
| **Inline social proof** (embed di halaman produk) | ❌                      | ✅                       | ✅                    |

**Gap utama:** **Review** (padahal di PRD = Should, dan ini pembeda kepercayaan) dan **Inline social proof** belum ada. Social counter & YouTube belum di-UI-kan.

Catatan presentasi: Tacto memilih tipe lewat **dropdown teks**; kompetitor memakai **galeri kartu visual dengan preview** tiap template — jauh lebih menjual & mudah dipahami.

### 3.3 Editor Notifikasi (kedalaman)

| Kemampuan                            | Tacto                                                            | WiserNotify                           | ProveSource             |
| ------------------------------------ | ---------------------------------------------------------------- | ------------------------------------- | ----------------------- |
| Preview desktop/mobile live          | ✅                                                               | ✅                                    | ✅                      |
| Variabel template                    | ✅ `{{first_name}}` dst                                          | ✅                                    | ✅                      |
| **Fallback values**                  | ❌ tak terlihat di UI                                            | ✅ eksplisit                          | ✅                      |
| Trim & kapitalisasi                  | ❌                                                               | ✅                                    | ✅                      |
| **Pilih data source per notifikasi** | ❌ (lihat U2)                                                    | ✅ pilih integrasi + filter           | ✅ pilih event + filter |
| Template/varian visual               | ❌ 1 bentuk saja                                                 | ✅ banyak template                    | ✅                      |
| **Click action** (aksi saat diklik)  | ❌                                                               | ✅                                    | ✅                      |
| Media fallback                       | ✅ (dropdown)                                                    | ✅ drag-urutan prioritas              | ✅                      |
| Styling                              | ⚠️ minim: accent color, rounded/square, small/medium, slide/fade | ✅ lengkap (font, warna, border, dsb) | ✅ lengkap              |
| Translations                         | ✅                                                               | ✅                                    | ✅                      |
| A/B variants                         | ✅                                                               | ✅ (tier Pro)                         | ✅                      |
| Label "✓ Verified"                   | ⚠️ konsep ada, toggle di editor tak terlihat                     | ✅ "Verify label"                     | —                       |

**Gap:** styling Tacto sangat minim (tak ada pilihan font, hanya 2 ukuran, 2 animasi, 2 bentuk), tak ada template visual, tak ada click action, tak ada fallback values/trim di UI, dan tak ada pemilihan data source per notifikasi.

### 3.4 Targeting / Display

Tacto **sudah baik** di sini: URL match (All/Exact/Contains/Regex), Visitor (first-time/returning), Countries, Referrer, UTM. Setara kompetitor. ✅

### 3.5 Pengaturan Global per Domain

**Kekuatan Tacto.** Panel "Domain settings" sudah lengkap: loop-after, urutan (random/manual), snooze on close, tombol close, consent/GDPR, filter profanity, geotargeting per-negara, blocked IPs, **export CSV/JSON + hapus semua event (GDPR)**, Custom CSS, Custom JS (gated Growth), dan forward event ke GA/GTM/Facebook Pixel/Mixpanel. Ini salah satu bagian terkuat & memenuhi FR-NGS. ✅

### 3.6 Analytics

| Aspek                                                  | Tacto                                | WiserNotify                                     | ProveSource                 |
| ------------------------------------------------------ | ------------------------------------ | ----------------------------------------------- | --------------------------- |
| Angka ringkas                                          | ✅ Impressions, Clicks, CTR, Rewards | ✅                                              | ✅                          |
| **Grafik tren waktu**                                  | ❌                                   | ✅ (Visitors/Impressions/Clicks/Hovers/Engaged) | ✅ daily trend              |
| **Date range + perbandingan**                          | ❌                                   | ✅ 24h/7d/30d/custom                            | ✅ custom + vs 30 hari lalu |
| Filter per-site/per-notifikasi                         | ⚠️ per-site saja                     | ✅                                              | ✅                          |
| **Breakdown audience** (device/negara/browser/halaman) | ❌                                   | ✅ (Visitor tab)                                | ✅                          |
| Filter bot                                             | ❌                                   | —                                               | ✅                          |
| **Export**                                             | ❌                                   | ✅ Excel                                        | ✅ Export                   |
| Events feed                                            | ✅ (filter type/source/verified)     | ✅                                              | ✅ Events Feed              |
| Goal tracking                                          | ✅ definisi goal ada                 | ✅ (tab Goal)                                   | ✅ Goals                    |
| Dampak goal / hasil A/B tampil                         | ❌ belum ada view-nya                | ✅                                              | ✅                          |

**Gap besar:** Analytics Tacto hanya 4 angka datar + events feed. Kompetitor punya grafik tren, date range + komparasi, breakdown audiens, filter bot, dan export. Selain itu, A/B dan Goals sudah bisa _didefinisikan_ di Tacto tapi **hasilnya belum ditampilkan** di mana pun.

### 3.7 Integrasi

| Aspek                     | Tacto                                               | WiserNotify                           | ProveSource                         |
| ------------------------- | --------------------------------------------------- | ------------------------------------- | ----------------------------------- |
| Jumlah                    | 44 platform terdaftar                               | 200+                                  | puluhan native                      |
| Jenis                     | Mayoritas **resep webhook** (tempel signing secret) | **Native/OAuth 1-klik** ("Integrate") | Native + pilih event per notifikasi |
| Kategori                  | e-commerce, CRM, forms, courses, marketing          | sama + lebih dalam                    | sama                                |
| Zapier/Make               | terdaftar                                           | ✅                                    | ✅                                  |
| Import review (Google/FB) | ❌                                                  | ✅                                    | ✅                                  |

**Catatan:** breadth katalog Tacto bagus (44 platform), tapi kedalamannya beda — kebanyakan panduan webhook manual, bukan koneksi OAuth plug-and-play. Pendekatan "webhook + Zapier dulu" memang sesuai PRD, jadi ini wajar untuk tahap awal — tapi untuk bersaing, beberapa integrasi top (Stripe, Shopify, WooCommerce) sebaiknya native & benar-benar terverifikasi berfungsi.

### 3.8 Support & Human Touch

| Aspek                             | Tacto       | WiserNotify                        | ProveSource                   |
| --------------------------------- | ----------- | ---------------------------------- | ----------------------------- |
| Live chat in-app                  | ❌          | ✅                                 | ✅                            |
| Email support                     | ❌ terlihat | ✅                                 | ✅                            |
| Video guides / help center        | ❌          | ✅                                 | ✅ Video Guides + Help Center |
| Setup call dengan manusia         | ❌          | ✅ "Book a 15-min call"            | ✅ "Call your clients"        |
| Garansi uang kembali / free trial | ❌          | ✅ 7-day trial + 14-day money-back | ✅ cancel anytime             |

**Gap strategis:** PRD Anda menyatakan diferensiasi utama = **"onboarding superior + support"**. Justru di sinilah Tacto paling kosong: tidak ada chat, help center, video, maupun setup call. Dua kompetitor berinvestasi besar di sini. Ini harus ditutup karena ini klaim moat Anda sendiri.

### 3.9 Akun / Profil / Team

- **Team:** undang teammate (Member/Admin) ✅.
- **Profile:** hanya display name + avatar URL. **Tidak ada** ganti password, 2FA, manajemen sesi, rename organisasi, atau hapus akun. ⚠️ minim.

---

## 4. Perbandingan Harga (termasuk fitur berbayar)

|                 | Tacto                                                              | WiserNotify                                                                   | ProveSource                                |
| --------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------ |
| Free            | 2.000 visitor, 1 site, badge                                       | plan gratis terbatas                                                          | 1.000 visitor                              |
| Entry           | **Starter $19/bln** — 10K visitor, 1 site, semua tipe, hapus badge | **Basic $59/thn** (~$5/bln) — 5K, multi-site, 200+ integrasi, live chat       | **Starter $24/bln** — 20K, custom branding |
| Mid             | **Growth $49/bln** — 100K, 3 site, A/B, custom CSS, goals          | **Pro $128/thn** — premium template, branding, A/B, goal, custom CSS, 1 staff | **Growth $45/bln** — 50K                   |
| High            | **Agency $99/bln** — 200K, 10 site                                 | **Growth $520/thn** — inline proof, dedicated AM, 10 staff                    | **Monster $91 / Gorilla $183** — 200K–500K |
| Trial / jaminan | ❌ tak ada                                                         | ✅ 7-hari trial + 14-hari money-back                                          | ✅ cancel anytime                          |
| Billing         | Bulanan saja                                                       | Tahunan (hemat 4 bln)                                                         | Bulanan & tahunan (2 bln gratis)           |

**Observasi:**

1. **Starter Tacto lemah value-nya:** tetap **1 site** (sama seperti Free) — satu-satunya nilai tambah dibanding Free hanya "hapus badge + traffic + semua tipe". Pertimbangkan beri ≥2 site atau fitur jelas di Starter.
2. **Tidak ada free trial / money-back.** Padahal PRD Anda menempatkan "harga jelas & mudah" sebagai pembeda, dan ketiga kompetitor menurunkan friksi beli dengan trial/garansi. Minimal tambahkan free trial berbayar atau jaminan uang-kembali.
3. **Hanya bulanan.** Kompetitor menawarkan tahunan (lebih murah efektif, mengunci retensi). Tambahkan opsi tahunan.
4. Harga implementasi ($19/$49/$99) lebih tinggi dari indikatif PRD ($12/$35/$79) — tidak masalah, tapi perlu divalidasi pasar.

---

## 5. Kesesuaian dengan Tujuan Bisnis (PRD)

| Tujuan PRD                                                   | Status di platform    | Catatan                                                                                                                                                              |
| ------------------------------------------------------------ | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Pasang pixel → notifikasi pertama ≤10 menit, tanpa ngoding" | 🔴 **Tidak tercapai** | Karena B1/B2, notifikasi **tidak akan pernah tampil** di site nyata. Checklist menjanjikan "<10 menit" tapi langkah "Show your first notification" mustahil selesai. |
| "Jual kenaikan konversi, ROI jelas"                          | 🟠 Setengah           | Goals ada, tapi analytics tak menunjukkan dampak goal/A-B → ROI belum bisa dibuktikan ke pelanggan.                                                                  |
| "Verified / ethical proof sebagai moat"                      | 🟠 Setengah           | Konsep verified ada (flag, filter), tapi belum ditonjolkan: toggle "✓ Verified" di editor & badge di widget belum terlihat. Ini moat Anda — harus menonjol.          |
| "Onboarding superior + support"                              | 🔴 Lemah              | Tak ada chat/help/video/setup-call. Justru pembeda yang Anda klaim paling kosong.                                                                                    |
| "Kesederhanaan & kecepatan"                                  | 🟢 Baik               | UI bersih, alur ringkas. (Tapi kesederhanaan ≠ kekurangan fitur inti seperti data source.)                                                                           |
| Target 300 akun berbayar / MRR $6K                           | 🔴 Belum mungkin      | Produk belum bisa dipakai pelanggan nyata.                                                                                                                           |

---

## 6. Ketidaksesuaian Brand/Style Guide 🟠

Brand Guidelines yang Anda lampirkan berjudul **"Tacto — The CRM for creators"** dan seluruh isinya tentang **CRM creator** (brand deal, pipeline, media kit, kalkulator tarif, "Nimbus Coffee / Instagram Reels"). Ini **produk yang sama sekali berbeda** dari aplikasi social-proof notification yang sebenarnya dibangun.

- Yang masih relevan & dipakai dengan baik: **logo (tile "T" + titik cyan), warna (Blue #3B82F6, Cyan #22D3EE, Ink, Paper), font Plus Jakarta Sans.** App memang memakai aksen biru & font ini. 👍
- Yang tidak cocok: **tagline, contoh UI (deal card, stage pipeline), dan contoh voice** semuanya untuk CRM creator, bukan notifikasi.
- App default ke **dark mode**, sedangkan style guide default **light (Paper)** — minor, tapi perlu disepakati.

**Rekomendasi:** jika style guide ini jadi sumber kebenaran brand, tulis ulang bagian positioning/voice/contoh-UI untuk produk notifikasi (jaga logo/warna/font). Kalau tidak, akan ada kebingungan brand saat membuat landing page, email, dsb.

---

## 7. Yang Sudah Bagus (jangan diubah) ✅

Supaya seimbang — ini kekuatan nyata Tacto:

- **UI bersih, konsisten, on-brand** (aksen biru, Plus Jakarta Sans, dark mode rapi).
- **Alur editor sesuai konvensi kategori** (Type→…→Launch) dengan **preview desktop/mobile live**.
- **Pengaturan global per-domain sangat lengkap** (loop, urutan, snooze, consent/GDPR, profanity, geotarget, blocked IP, export/erase data, custom CSS/JS, forward ke GA/GTM/FB/Mixpanel).
- **Katalog integrasi luas** (44 platform) dengan instruksi + verifikasi signature.
- **Sudah punya Goals, A/B variants, translations** di editor.
- **Conversion widgets (popup, bar, spin-to-win) sudah ada** — di depan jadwal MVP.
- **Keamanan dasar solid:** session httpOnly cookie, widget domain-locked (origin non-terdaftar ditolak 403 — anti pencurian siteKey), verifikasi signature webhook, **konfirmasi sebelum hapus site**, penegakan batas paket (Free = 1 site), badge di tier gratis.

---

## 8. Daftar Lengkap Kekurangan (checklist berprioritas)

### 🔴 Blocker (produk tak bisa dipakai tanpa ini)

- [ ] **B1** Snippet pixel menunjuk `http://localhost:8080/t.js` → harus CDN produksi `https://...`
- [ ] **B2** Backend di ngrok free → deploy produksi sungguhan (domain + env + TLS)
- [ ] **B3** Endpoint ingest integrasi di ngrok → arahkan ke domain produksi
- [ ] Verifikasi pixel tak akan pernah berhasil selama B1 belum beres

### 🟠 High (bug & gap yang terasa langsung)

- [ ] **U1** Gagal buat site tanpa pesan error + tak ada normalisasi domain (tolak `example.com` & `https://`, placeholder sendiri menyesatkan)
- [ ] **U2** Label langkah editor tertukar; tak ada langkah **data source** sebenarnya (pilih event + filter per notifikasi)
- [ ] **U3** Billing lambat memuat paket (akibat B2)
- [ ] Analytics terlalu dangkal: tak ada grafik, date range, komparasi, breakdown audiens, filter bot, export
- [ ] Hasil **Goal & A/B** belum ditampilkan di mana pun (padahal didefinisikan)
- [ ] Tak ada **support in-app** (chat/email/help center/video/setup call) — padahal ini moat yang diklaim PRD
- [ ] Tak ada **panduan install per-platform** (Shopify/WP/Webflow/GTM) & tombol verifikasi/debug mode

### 🟡 Medium (gap fitur vs kompetitor berbayar)

- [ ] Tipe **Review** (impor Google/Facebook) belum di-UI-kan
- [ ] **Inline social proof** (embed stats di halaman produk) belum ada
- [ ] Tipe **Social counter** & **YouTube** belum di-UI-kan
- [ ] Styling editor minim: tak ada font, hanya 2 ukuran/2 animasi/2 bentuk; tak ada template visual; tak ada click action; tak ada fallback values/trim di UI
- [ ] Integrasi kebanyakan resep webhook, bukan native OAuth untuk platform top (Stripe/Shopify/Woo)
- [ ] Label **"✓ Verified"** belum ditonjolkan di editor/widget (moat utama)
- [ ] Tak ada **free trial / money-back / paket tahunan**; value **Starter** tipis (tetap 1 site)
- [ ] Profil/akun minim: tak ada ganti password, 2FA, sesi, rename org, hapus akun

### 🟢 Polish

- [ ] Pemilih tipe pakai dropdown → ganti ke **galeri kartu visual** dengan preview
- [ ] Empty-state & onboarding masih polos → tambah guided setup + tombol kirim **test event**
- [ ] Brand/style guide masih "CRM for creators" → selaraskan ke produk notifikasi
- [ ] Sepakati default tema (app dark vs guide light)

---

## 9. Langkah Selanjutnya (rencana aksi)

### Fase 0 — Jadikan produk benar-benar hidup (WAJIB, sekarang)

1. **Deploy produksi** sesuai Bab 8 SRS: `app`, `db`, `worker`, `proxy` via Docker Compose, di server/host nyata dengan domain tetap.
2. **Set env produksi:** `WIDGET_CDN_URL` → CDN tempat `t.js` di-serve (`https://cdn.tacto.software/t.js` atau sejenis), `APP_URL`, `DATABASE_URL`, `STRIPE_*`, dll.
3. **Serve `t.js` lewat HTTPS/CDN** dan ganti generator snippet agar memakai `WIDGET_CDN_URL` — bukan `localhost`.
4. **Arahkan endpoint ingest** di halaman integrasi ke domain produksi.
5. **Uji end-to-end di site nyata** (`hrgrowth.id`): pasang snippet → pixel terdeteksi → kirim event uji → notifikasi tampil → impression tercatat di analytics. Baru setelah ini lolos, produk "jadi".

### Fase 1 — Perbaiki bug & kepercayaan dasar (minggu yang sama)

6. Tampilkan **error validasi** di form buat-site + **normalisasi domain** (strip `http(s)://`, trailing slash, spasi) + ganti placeholder agar tidak menyesatkan.
7. **Benahi editor:** perbaiki label langkah, dan tambahkan langkah **Data Source** nyata (pilih sumber event + filter) — contoh langsung dari ProveSource "Track" & WiserNotify "Data source".
8. Perbaiki latensi (hasil dari Fase 0) sehingga Billing & dashboard responsif.

### Fase 2 — Setara kompetitor (2–4 minggu)

9. **Analytics v2:** grafik tren + date range + komparasi + breakdown (device/negara/halaman) + export + filter bot. Tampilkan **hasil Goal & A/B**.
10. **Tipe Review** + **impor review Google/Facebook**; UI-kan Social counter.
11. **Support in-app:** minimal widget chat (Crisp/Intercom), help center, 2–3 video guide, dan opsi "book a setup call". (Ini moat Anda.)
12. **Panduan install per-platform** (Shopify/WP/Webflow/GTM) + tombol **Verify** eksplisit + **Debug/Test mode**.
13. Perkuat editor: template visual, click action, fallback values/trim di UI, lebih banyak opsi style.

### Fase 3 — Monetisasi & diferensiasi (4–8 minggu)

14. Tonjolkan **Verified proof** (toggle + badge "✓ Verified") sebagai nilai jual.
15. **Inline social proof** (embed di halaman produk).
16. Paket **tahunan + free trial + money-back**; perbaiki value **Starter**.
17. Integrasi **native** untuk Stripe/Shopify/WooCommerce (bukan hanya resep webhook).
18. Selesaikan akun: ganti password, 2FA, manajemen sesi.
19. Selaraskan **brand/style guide** ke produk notifikasi.

---

_Review ini dibuat dengan menelusuri ketiga platform secara langsung. Untuk uji Fase 0, saya sudah membuat site `hrgrowth.id` di akun Tacto Anda (siteKey tersimpan di platform). Site uji `demostore.com` sudah dihapus kembali._
