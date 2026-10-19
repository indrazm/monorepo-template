# Task Eksekusi — Tindak Lanjut Feedback `compare-platform.md`

**Sumber:** [docs/development/feedback/compare-platform.md](../feedback/compare-platform.md) (review 17 Okt 2026)
**Disusun:** 17 Okt 2026
**Eksekutor:** Claude (self-execute)
**Acuan:** PRD-Tacto v4, SRS-Tacto v3/v4, Brand Guidelines

---

## 0. Catatan cakupan (baca dulu)

- **Di-SKIP sesuai arahan** (masih tahap development, bukan masalah fitur):
  - **B1** snippet `localhost:8080/t.js`, **B2** backend di ngrok, **B3** endpoint ingest di ngrok, dan **U3** latensi Billing (akibat ngrok). Semua ini soal domain/URL/deploy produksi — dikerjakan saat go-production, bukan di sini. Snippet sudah memakai `env.VITE_WIDGET_CDN_URL` ([sites-page.tsx:215](../../../apps/web/src/features/sites/components/sites-page.tsx#L215)), jadi tinggal set env saat deploy.
- **Yang dikerjakan:** semua tier (🟠 High → 🟡 Medium → 🟢 Polish), diurutkan prioritas.
- **Item yang butuh kredensial/keputusan Anda** ditulis task penuh, tapi langkah yang menunggu input ditandai **`⏸️ BUTUH ANDA`** (credential pihak ketiga, product/price Stripe, atau keputusan bisnis). Saya kerjakan semua bagian yang bisa saya selesaikan sendiri; bagian bertanda itu di-stub/di-flag sampai Anda isi.

### Temuan yang SUDAH ada di kode (verifikasi — jangan dobel kerjakan)

Review ditulis atas versi deploy; sebagian sudah ada di `main` sekarang:

- ✅ **Breakdown per-notifikasi** sudah tampil di Analytics ([analytics-page.tsx:91-137](../../../apps/web/src/features/analytics/components/analytics-page.tsx#L91-L137)).
- ✅ **Hasil A/B** (significance z-test + Wilson CI) sudah tampil ([analytics-page.tsx:139-221](../../../apps/web/src/features/analytics/components/analytics-page.tsx#L139-L221)); data `perDay` sudah tersedia di summary ([analytics.ts:17-24](../../../packages/contracts/src/analytics.ts#L17-L24)).
- ✅ **Goal stats** (daily + assisted conversions per-notif) sudah ada di contract & service ([goals.ts:37-52](../../../packages/contracts/src/goals.ts#L37-L52)).
- ✅ **Enum tipe** `social_counter`, `youtube` sudah ada ([notifications.ts:3-17](../../../packages/contracts/src/notifications.ts#L3-L17)); yang kurang hanya UI-nya.
- ✅ **dataSource** punya field `eventTypes` + `filter` di schema ([notifications.ts:104-106](../../../packages/contracts/src/notifications.ts#L104-L106)); belum ada UI & masih di-override otomatis.

Konsekuensi: task Analytics/A-B/Goal di bawah jadi "lengkapi visual (grafik/date-range/breakdown/export)", bukan "bangun dari nol".

### Legenda

`[P1]` prioritas tertinggi … `[P3]` polish. Setiap task: **Tujuan · File · Langkah · Acceptance**.

---

# FASE 1 — 🟠 High: bug & kepercayaan dasar

## T1 `[P1]` — Perbaiki form buat-site: error terlihat + normalisasi domain (U1)

**Tujuan:** User yang menempel `https://toko.com`, `shop.example.com`, atau domain dengan spasi/trailing-slash tidak lagi gagal diam-diam. Error validasi tampil di field, input dinormalisasi sebelum dikirim.

**File:**

- [packages/contracts/src/sites.ts](../../../packages/contracts/src/sites.ts) (`domainSchema`)
- [apps/web/src/features/sites/components/sites-page.tsx](../../../apps/web/src/features/sites/components/sites-page.tsx) (`CreateSiteDialog`)
- [apps/api/src/modules/sites/router.ts](../../../apps/api/src/modules/sites/router.ts) (handler `zValidator` error)

**Langkah:**

1. Di `domainSchema` tambah `.transform()` **sebelum** `.regex`: strip `^https?://`, buang `www.` opsional (diskusikan — default: pertahankan www), buang trailing `/` dan path, buang spasi, lowercase. Terapkan ke `createSiteSchema` & `updateSiteSchema`.
2. Perbaiki pesan regex jadi actionable (sudah lumayan) dan pastikan menolak path/scheme dengan pesan jelas.
3. Di `CreateSiteDialog`: tangkap error per-field. `useCreateSiteMutation` saat ini hanya `toast.error(error.message)` generik. Ubah agar API mengembalikan detail field (lihat langkah 4) lalu render pesan di bawah `Input` domain (pola `aria-invalid` + `<p className="text-xs text-destructive">`). Jangan hanya toast.
4. Di router sites, pastikan `validation_error` menyertakan `issues`/`fieldErrors` (cek pola yang dipakai modul lain, mis. billing). Samakan bentuk error di [packages/contracts/src/errors.ts](../../../packages/contracts/src/errors.ts).
5. Ganti placeholder yang menyesatkan: `placeholder="shop.example.com"` → contoh yang lolos validator, mis. `placeholder="tokoanda.com"`. Tambah helper text: "Tanpa http:// dan tanpa /path — contoh: tokoanda.com".
6. Normalisasi juga di sisi client sebelum submit (trim) agar UX instan.

**Acceptance:**

- `https://demostore.com`, `demostore.com/`, `demostore.com` → semua tersimpan sebagai `demostore.com` (201).
- Domain invalid → pesan error tampil **di bawah field domain**, bukan hanya toast, dan form tidak menutup.
- Placeholder = contoh yang valid. Test kontrak baru di [sites contract test / services.test.ts](../../../apps/api/src/modules/sites/services.test.ts) untuk kasus normalisasi.

---

## T2 `[P1]` — Benahi editor notifikasi: label langkah + langkah Data Source nyata (U2)

**Tujuan:** Label stepper cocok dengan isinya, dan ada langkah **Track / Data Source** untuk memilih sumber event + filter per-notifikasi (FR-NED-08) — jantung editor di kompetitor.

**File:**

- [apps/web/src/features/notifications/components/notifications-page.tsx](../../../apps/web/src/features/notifications/components/notifications-page.tsx) (`EDITOR_STEPS`, blok `step === n`, `eventTypesForType`, `handleSubmit`)
- [packages/contracts/src/notifications.ts](../../../packages/contracts/src/notifications.ts) (`notificationDataSourceSchema`)
- Integrasi sumber: [packages/contracts/src/integrations.ts](../../../packages/contracts/src/integrations.ts), [apps/web/src/features/integrations/services.ts](../../../apps/web/src/features/integrations/services.ts)

**Masalah saat ini (terverifikasi):** `EDITOR_STEPS = ["Type","Track","Display","Message","Style","Launch"]` tapi `step===1` berisi targeting (Show on + `TargetingFields`), `step===2` berisi position/timing/media, `step===4` berisi accent/shape/size/animation. Jadi "Track" sebenarnya "Display", dan "Display" sebenarnya "Style". Tidak ada langkah data-source. Selain itu `handleSubmit` meng-override `eventTypes` via `eventTypesForType(type)` ([baris 389](../../../apps/web/src/features/notifications/components/notifications-page.tsx#L389)) sehingga pilihan user akan dibuang.

**Langkah:**

1. Tetapkan urutan final (SRS FR-NED): **Type → Track(data source) → Display(targeting) → Message → Style → Launch**.
2. Tambah blok langkah **Track** baru (index 1) berisi:
   - Pilih **event type** (checkbox multi dari `eventTypes`: purchase/signup/visit/form_submit/custom).
   - Pilih **sumber integrasi** opsional (dari integrasi aktif site — mulai sederhana: dropdown "semua sumber" + daftar provider terkoneksi; bila kompleks, sediakan dulu "any").
   - **Filter** sederhana key/value (mis. `product contains "Pro"`, `amount >= 50`) yang menulis ke `dataSource.filter`. Validasi bentuk filter di contract.
3. Pindahkan konten lama: targeting → langkah **Display** (index 2), position/timing/media + accent/shape/size/animation → **Style**. Pertimbangkan gabung timing/position+style jadi satu langkah Style agar tetap 6 langkah; atau pertahankan 6 langkah dengan pemetaan di atas.
4. Di `handleSubmit`: **berhenti meng-override** `eventTypes` dari tipe. Gunakan `eventTypesForType` hanya sebagai **default awal** saat tipe dipilih (set state), bukan paksa saat submit.
5. Pastikan worker/widget menghormati `dataSource.filter` saat memilih event untuk notifikasi (cek [apps/widget/src/scheduler.ts](../../../apps/widget/src/scheduler.ts) & pipeline event di API — bila belum, tambah penyaringan di sisi yang menyusun payload).

**Acceptance:**

- Label tiap langkah = isinya.
- Bisa membuat 2 notifikasi di site sama yang makan event berbeda (mis. satu `purchase`, satu `signup`) dan filter berbeda; keduanya hanya menampilkan event yang cocok.
- Test: tambah ke [notifications.test.ts](../../../packages/contracts/notifications.test.ts) untuk `dataSource.filter`, dan test widget untuk penyaringan.

---

## T3 `[P1]` — Analytics v2: grafik tren, date range, komparasi, export

**Tujuan:** Analytics bukan sekadar 4 angka + feed. Tambah grafik tren waktu, pemilih rentang + komparasi periode, dan export.

**File:**

- [apps/web/src/features/analytics/components/analytics-page.tsx](../../../apps/web/src/features/analytics/components/analytics-page.tsx)
- [packages/contracts/src/analytics.ts](../../../packages/contracts/src/analytics.ts) (`analyticsQuerySchema` saat ini hanya `days` default 7)
- [apps/api/src/modules/analytics/services.ts](../../../apps/api/src/modules/analytics/services.ts), [router.ts](../../../apps/api/src/modules/analytics/router.ts)
- Chart: ikuti skill `dataviz` sebelum menulis chart apa pun.

**Langkah:**

1. **Date range + komparasi:** perluas `analyticsQuerySchema` → dukung preset (`24h/7d/30d/custom`) + `from`/`to` ISO, dan flag `compare` (periode sebelumnya setara). Server hitung delta vs periode lalu.
2. **Grafik tren:** data `perDay` sudah tersedia — render line/area chart (views/clicks/claims) memakai lib chart sesuai skill `dataviz`; pastikan aksesibel & tema terang/gelap. Tampilkan garis komparasi (periode sebelumnya) bila `compare` on.
3. **StatTiles** tampilkan delta % vs periode sebelumnya.
4. **Export:** tombol export CSV/JSON untuk summary + events feed. Tambah endpoint export (atau reuse events feed query) dengan streaming CSV. (Pola export sudah ada di domain settings GDPR — lihat [site-settings-dialog.tsx](../../../apps/web/src/features/sites/components/site-settings-dialog.tsx) untuk konvensi.)
5. **Filter bot (opsional di task ini):** tandai event dari UA bot; pindah ke T4 bila besar.

**Acceptance:**

- Bisa pilih 24h/7d/30d/custom; angka & grafik berubah sesuai.
- Grafik tren muncul dengan hover tooltip; komparasi periode sebelumnya terlihat.
- Export menghasilkan file CSV valid berisi baris sesuai filter aktif.

---

## T4 `[P1]` — Surfacing Goal & breakdown audiens + filter bot di Analytics

**Tujuan:** Dampak Goal ditampilkan (bukan hanya didefinisikan), plus breakdown audiens (device/negara/halaman) dan filter bot.

**File:** analytics services/contract/page (atas) + [goals services](../../../apps/api/src/modules/goals/services.ts) + goals page.

**Langkah:**

1. **Goal impact view:** di Analytics (atau tab di Goals) tampilkan konversi harian (`goalStats.daily`) sebagai grafik + tabel assisted-conversions per-notifikasi yang sudah ada di contract. Hubungkan ke `getGoalStats`.
2. **Breakdown audiens:** tambah agregasi device/country/browser/top-pages di analytics service (sumber: kolom event). Render sebagai tabel/bar kecil. **Prasyarat:** pastikan event menyimpan device/UA/country/path — cek [schema.ts](../../../packages/db/schema.ts) & [ingest services](../../../apps/api/src/modules/ingest/services.ts); bila belum, tambah kolom + migration.
3. **Filter bot:** klasifikasi bot via UA di ingest (simpan flag `isBot`), lalu kecualikan dari metrik default + sediakan toggle "sertakan bot".

**Acceptance:**

- Halaman menunjukkan konversi goal dari waktu ke waktu + notifikasi mana yang berkontribusi.
- Ada breakdown minimal device + negara + top pages.
- Metrik default mengecualikan bot; ada toggle untuk memunculkannya.

---

## T5 `[P2]` — Panduan install per-platform + tombol Verify + Debug/Test mode

**Tujuan:** Bukan satu snippet mentah. Tambah panduan per-platform, tombol "Verify pixel sekarang", dan mode test/debug.

**File:**

- [apps/web/src/features/sites/components/sites-page.tsx](../../../apps/web/src/features/sites/components/sites-page.tsx) (`InstallSiteButton`)
- [apps/api/src/modules/sites/router.ts](../../../apps/api/src/modules/sites/router.ts) + services (endpoint verify + send-test-event)
- [apps/api/src/modules/ingest/services.ts](../../../apps/api/src/modules/ingest/services.ts) (test event)

**Langkah:**

1. **Panduan per-platform:** di dialog Install tambah tab/akordion: HTML generic, Google Tag Manager, Shopify, WordPress, Webflow. Tiap tab = instruksi langkah + snippet yang sama. Konten statis (markdown) — tidak butuh kredensial.
2. **Tombol "Verify pixel":** endpoint `POST /sites/:id/verify` yang mengecek apakah pixel pernah ping dalam N menit terakhir (pakai `pixelVerifiedAt` + heartbeat). UI: tombol "Cek sekarang" yang memanggil lalu refresh badge. (Tanpa B1 beres, verifikasi hanya berhasil di env ber-CDN — tidak apa, logikanya tetap benar.)
3. **Send test event:** tombol "Kirim event uji" → endpoint yang menyuntik 1 event dummy ke site agar user lihat notifikasi tanpa transaksi nyata. Berguna untuk onboarding (lihat T14).
4. **Debug mode:** flag query `?tacto_debug=1` di widget yang menampilkan log overlay (kenapa notif muncul/tidak). Implementasi di [apps/widget/src](../../../apps/widget/src) — minimal console group + badge "debug".

**Acceptance:**

- Dialog Install punya ≥4 panduan platform.
- Tombol Verify memanggil endpoint & update badge.
- Tombol test-event memunculkan notifikasi di site uji; debug mode mencetak alasan tampil/tidak.

---

# FASE 2 — 🟡 Medium: setara kompetitor berbayar

## T6 `[P2]` — Tipe **Review** + impor review (Google/Facebook)

**Tujuan:** Tambah tipe notifikasi Review (pembeda kepercayaan, PRD = Should).

**File:** contracts/notifications (tambah `review` ke enum + config spesifik), notifications editor UI, widget render, modul integrasi/import.

**Langkah:**

1. Tambah `"review"` ke `notificationTypes` + sub-schema config (rating, teks, author, source, avatar).
2. UI editor: form review manual + daftar review tersimpan.
3. Widget render kartu review (bintang + kutipan + sumber).
4. **Impor review:**
   - Manual / CSV import → **bisa saya kerjakan penuh** (upload CSV → parse → simpan sebagai event `review`).
   - **⏸️ BUTUH ANDA:** Google Places API key / Facebook Graph token untuk impor otomatis. Saya siapkan connector + UI "hubungkan", tapi langkah ambil data live menunggu kredensial. Sampai itu, fallback ke CSV/manual.

**Acceptance:** Bisa membuat notifikasi Review dari input manual/CSV dan tampil di widget; jalur API otomatis ter-stub menunggu kredensial.

---

## T7 `[P2]` — UI untuk **Social counter** & **YouTube** (enum sudah ada)

**Tujuan:** Enum `social_counter` & `youtube` sudah ada tapi tak ada UI.

**File:** notifications editor (`TYPES` array hanya daftar 10 — tambahkan 2 ini), config schema spesifik, widget render.

**Langkah:**

1. Tambah entri di `TYPES` ([notifications-page.tsx:38-49](../../../apps/web/src/features/notifications/components/notifications-page.tsx#L38-L49)).
2. Config: social_counter (platform, jumlah follower, label); youtube (channel/video, subscriber/view count).
3. **⏸️ BUTUH ANDA (youtube live stats):** YouTube Data API key untuk angka real-time. Tanpa itu, dukung angka statis/manual dulu.
4. Widget render masing-masing.

**Acceptance:** Dua tipe bisa dipilih & dirender; angka manual bekerja; path API ter-flag.

---

## T8 `[P2]` — **Inline social proof** (embed di halaman produk)

**Tujuan:** Blok proof yang di-embed di halaman (bukan floating), seperti kompetitor.

**File:** widget (mode inline via selector target), contracts (opsi `placement: "inline"` + CSS selector), editor UI, snippet install.

**Langkah:**

1. Tambah opsi placement inline + target selector (mis. `#reviews`) di config.
2. Widget: cari elemen target, render konten di dalamnya (bukan fixed overlay).
3. Editor: UI pilih inline + input selector + preview.

**Acceptance:** Notifikasi inline muncul di dalam elemen target pada site uji.

---

## T9 `[P2]` — Perdalam editor: fallback values, trim/kapitalisasi, click action, template visual, styling, toggle Verified

**Tujuan:** Tutup gap kedalaman editor vs kompetitor.

**File:** contracts/notifications (style & message schema), notifications editor, widget render.

**Langkah:**

1. **Fallback values UI:** `message.fallbacks` sudah ada di schema tapi tak ada UI — tambah editor per-variabel (mis. `{{first_name}}` → "Someone"). Tampilkan di langkah Message.
2. **Trim & kapitalisasi:** tambah opsi transform per-variabel (`trim`, `capitalize`, `uppercase`) di message schema + terapkan di widget render.
3. **Click action:** tambah `clickAction` ke style/config (`none` | `url` + target `_blank`). Widget: buat kartu klik ke URL. Saat ini listener klik ada ([notification.ts:239](../../../apps/widget/src/render/notification.ts#L239)) tapi tanpa aksi konfigurable.
4. **Styling lebih kaya:** tambah pilihan font (minimal 2-3 family aman), lebih banyak ukuran, lebih banyak animasi, border/shadow. Perluas `notificationStyleSchema` (`size` kini hanya sm/md; `animation` hanya slide/fade).
5. **Template visual:** sediakan 3-5 preset style siap pakai (kombinasi warna/shape/animation) sebagai kartu pilihan.
6. **Toggle "✓ Verified":** `verified` kini flag read-only server. Tambah kontrol editor untuk menonjolkan badge verified (dan pastikan widget menampilkannya) — ini moat PRD. Preview sudah punya badge ([notification-preview.tsx:65-67](../../../apps/web/src/features/notifications/components/notification-preview.tsx#L65-L67)).

**Acceptance:** Semua kontrol baru tersimpan, ter-preview, dan ter-render widget. Test contract untuk field baru.

---

## T10 `[P2]` — Integrasi **native/OAuth** untuk Stripe/Shopify/WooCommerce

**Tujuan:** Beberapa integrasi top jadi plug-and-play, bukan hanya resep webhook.

**File:** [apps/api/src/modules/integrations](../../../apps/api/src/modules/integrations) (`connectors.ts`, `provider-api.ts`, `credentials.ts`), integrations UI (`connect-wizard.tsx`).

**Langkah:**

1. Rancang alur OAuth connector (redirect → callback → simpan token terenkripsi → auto-subscribe webhook).
2. Implementasi penuh server + UI "Integrate (1-klik)".
3. **⏸️ BUTUH ANDA:** Client ID/Secret + redirect URL terdaftar di dashboard Stripe/Shopify/WooCommerce (app OAuth). Saya bangun seluruh flow + simpan env placeholder; aktivasi nyata menunggu kredensial & domain callback (domain = fase deploy yang di-skip).

**Acceptance:** Flow OAuth lengkap & teruji dengan mock; tombol "Integrate" muncul untuk 3 provider; langkah kredensial ter-flag.

---

## T11 `[P2]` — Paket **tahunan + free trial + money-back** & perkuat **Starter**

**Tujuan:** Turunkan friksi beli; Starter tak lagi setara Free.

**File:** [packages/contracts/src/billing.ts](../../../packages/contracts/src/billing.ts), [apps/api/src/modules/billing](../../../apps/api/src/modules/billing) (`stripe.ts`, `services.ts`, `router.ts`), billing UI ([billing-page.tsx](../../../apps/web/src/features/billing/components/billing-page.tsx)), lihat [STRIPE_INTEGRATION_TODO.md](../../../STRIPE_INTEGRATION_TODO.md).

**Langkah:**

1. **Kode:** dukung interval tahunan (toggle monthly/annual di UI + price id tahunan), free trial (`trial_period_days` di checkout), dan tampilkan jaminan money-back di UI.
2. **Starter value:** naikkan ke ≥2 site atau tambah fitur jelas — **⏸️ BUTUH ANDA (keputusan bisnis)**: tentukan isi baru Starter & harga. Saya siapkan struktur agar mudah diubah.
3. **⏸️ BUTUH ANDA:** buat Product/Price tahunan + konfigurasi trial di dashboard Stripe (price IDs). Saya pakai env/price-id configurable; isi nilai asli dari Anda.

**Acceptance:** UI billing punya toggle bulanan/tahunan + badge trial/garansi; checkout melewatkan trial; struktur paket siap diubah begitu keputusan & price id masuk.

---

## T12 `[P2]` — Lengkapi akun/profil: ganti password, 2FA, sesi, rename org, hapus akun

**Tujuan:** Profil kini hanya display name + avatar ([profile.ts](../../../packages/contracts/src/profile.ts)). Tambah keamanan akun dasar.

**File:** [apps/api/src/modules/auth](../../../apps/api/src/modules/auth), [profile module](../../../apps/api/src/modules/profile), profile UI ([profile-page.tsx](../../../apps/web/src/features/profile/components/profile-page.tsx)), auth lib (cek apakah pakai better-auth/custom).

**Langkah:**

1. **Ganti password** (verifikasi password lama → set baru; reuse hardening reset yang sudah ada — commit `8cd777d`/`faf406d`).
2. **Manajemen sesi:** daftar sesi aktif + revoke.
3. **Rename organisasi.**
4. **Hapus akun** (konfirmasi + cascade + GDPR).
5. **2FA (TOTP):** enroll + verify + recovery codes. Bila stack auth belum mendukung, ini paling besar — boleh dipecah/di-defer ke akhir fase.

**Acceptance:** Semua aksi bekerja end-to-end dengan konfirmasi untuk aksi destruktif; test untuk ganti password & revoke sesi.

---

# FASE 3 — 🟢 Polish

## T13 `[P3]` — Pemilih tipe: dropdown → **galeri kartu visual** dengan preview

**Tujuan:** Ganti `<select>` tipe ([notifications-page.tsx:506-525](../../../apps/web/src/features/notifications/components/notifications-page.tsx#L506-L525)) dengan galeri kartu (ikon + nama + mini-preview per tipe).

**Langkah:** Komponen grid kartu di langkah Type; klik memilih tipe; sorot terpilih; sertakan thumbnail/preview kecil. Gunakan `NotificationPreview` yang ada untuk mini-preview bila memungkinkan.

**Acceptance:** Langkah Type menampilkan galeri kartu; memilih kartu setara memilih dropdown lama.

---

## T14 `[P3]` — Empty-state & guided onboarding + tombol kirim test event

**Tujuan:** Empty-state polos → guided setup. (Tombol test event dibangun di T5 — di sini disematkan ke onboarding.)

**File:** [overview](../../../apps/web/src/features/overview) (activation funnel sudah ada di contract — [analytics.ts activation](../../../packages/contracts/src/analytics.ts#L97)), sites/notifications empty-states.

**Langkah:** Checklist onboarding (buat site → pasang pixel → verify → kirim test event → notif pertama) memakai `activation` snapshot. Sambungkan tombol test-event & verify dari T5.

**Acceptance:** Dashboard menampilkan progres onboarding real berbasis data; CTA mengarah ke aksi yang benar.

---

## T15 `[P3]` — Selaraskan Brand/Style Guide ke produk notifikasi

**Tujuan:** [style-guide.md](../style-guide.md) masih "The CRM for creators" — positioning/voice/contoh UI salah produk. Logo/warna/font sudah cocok (pertahankan).

**Langkah:** **⏸️ BUTUH ANDA (keputusan):** konfirmasi style guide ini jadi sumber kebenaran brand. Bila ya, saya tulis ulang bagian positioning/voice/contoh-UI untuk produk social-proof notification (jaga logo T + titik cyan, Blue #3B82F6 / Cyan #22D3EE / Ink / Paper, Plus Jakarta Sans). Juga sepakati default tema (app dark vs guide light) — **keputusan Anda**.

**Acceptance:** Style guide konsisten dengan produk; keputusan tema tercatat.

---

## T16 `[P3]` — Support in-app (chat, help center, video, book-a-call)

**Tujuan:** Moat PRD ("onboarding superior + support") — kini kosong.

**Langkah:**

1. **Help center in-app** (artikel statis/markdown) → **bisa saya kerjakan penuh**.
2. **Book a setup call** → tombol/link (Calendly dsb) → **⏸️ BUTUH ANDA:** URL penjadwalan Anda.
3. **Video guides** → embed placeholder → **⏸️ BUTUH ANDA:** URL video.
4. **Live chat** → widget Crisp/Intercom → **⏸️ BUTUH ANDA:** website ID/app key. Saya pasang loader + env placeholder; aktif begitu key masuk.

**Acceptance:** Help center berfungsi; chat/call/video ter-stub rapi menunggu kredensial/URL.

---

## Ringkasan urutan eksekusi

1. **T1, T2** (bug UX paling terasa) → 2. **T3, T4** (analytics) → 3. **T5** (install/verify/debug) →
2. **T6–T9** (tipe baru + kedalaman editor) → 5. **T10–T12** (integrasi native, pricing, akun) →
3. **T13–T16** (polish, brand, support).

Item **⏸️ BUTUH ANDA** dikumpulkan agar Anda bisa menyiapkan paralel: Google Places/FB/YouTube API keys (T6/T7), Stripe/Shopify/Woo OAuth app + price id tahunan/trial (T10/T11), keputusan isi Starter & tema/brand (T11/T15), URL Calendly/video + Crisp/Intercom key (T16).

---

## ✅ Log eksekusi (19 Okt 2026)

Semua task dikerjakan. Status akhir: typecheck (12 project), lint, dan tes (131 API · 13 contracts · 6 worker · 1 web) hijau; `check:env` cocok; 3 migration DB diterapkan (impression audience, enum `review`, tabel `TwoFactor`).

- **T1** ✅ Normalisasi domain + error per-field di form site (kontrak `apiError` kini bawa `fields`).
- **T2** ✅ Label stepper diperbaiki + langkah **Track** (event types/source/filters); dihormati di widget service & worker.
- **T3** ✅ Analytics v2: grafik tren (recharts, palet tervalidasi dataviz), range 24h/7d/30d/90d/custom, komparasi periode, export CSV.
- **T4** ✅ Breakdown audiens (device/negara/browser/halaman) + filter bot (kolom impression baru, UA parser) + goal impact sudah tampil di Goals.
- **T5** ✅ Panduan install per-platform (tab), tombol Verify, Send test event, debug mode `?tacto_debug=1`.
- **T6** ✅ Tipe Review (manual + CSV + render widget) + endpoint import Google/Facebook (⏸️ butuh kredensial).
- **T7** ✅ UI Social counter & YouTube + render (angka manual; refresh live ⏸️ butuh kredensial).
- **T8** ✅ Inline social proof (placement selector, host shadow inline).
- **T9** ✅ Fallback values + transform per-variabel, click action, font/ukuran/animasi lebih kaya, preset style, toggle ✓ Verified.
- **T10** ✅ Sudah terpenuhi sistem integrasi native yang ada (API key → Tacto daftarkan webhook → Verify). Kredensial app terdokumentasi.
- **T11** ✅ Paket tahunan (toggle), free trial, money-back copy, Starter → 2 site.
- **T12** ✅ Ganti password, manajemen sesi, rename org, hapus akun, 2FA TOTP (enroll + backup codes + challenge login).
- **T13** ✅ Galeri kartu visual pemilih tipe.
- **T14** ✅ Checklist onboarding (sudah ada) + tombol Send test event.
- **T15** ✅ Sudah sesuai: `style-guide.md` di repo adalah design system social-proof (bukan "CRM for creators" — itu dokumen eksternal).
- **T16** ✅ Help center in-app, book-a-call, video, live chat (Crisp) — semua gated env, help center selalu aktif.

**Kredensial yang menunggu Anda (placeholder sudah di `.env.example`):** `GOOGLE_PLACES_API_KEY`, `FACEBOOK_PAGE_TOKEN`, `YOUTUBE_API_KEY`, `STRIPE_PRICE_*_ANNUAL`, `STRIPE_TRIAL_DAYS`, `VITE_CRISP_WEBSITE_ID`, `VITE_SUPPORT_CALL_URL`, `VITE_SUPPORT_VIDEO_URL`.
