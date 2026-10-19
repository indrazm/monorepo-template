# Task Lanjutan — Sisa Perbaikan Audit Tacto

**Disusun:** 19 Oktober 2026
**Status:** Batch 1–4 selesai; dokumen ini mencakup Batch 5–7.
**Sumber:** audit internal (notifikasi/widget, analytics/goals, billing, integrasi/ingest/worker, sites/team/profile, security).
**Acuan:** PRD-Tacto v4, SRS-Tacto v3/v4, `docs/backend.md`, `docs/frontend.md`, `docs/database.md`, `docs/contracts.md`, `docs/worker.md`.

---

## 0. Cara memakai dokumen ini

- Satu task = satu perubahan yang bisa di-review dan di-commit sendiri.
- Urutan pengerjaan: **Batch 5 → Batch 6 → Batch 7**.
- Setiap task memuat: tujuan, file, langkah, acceptance, dan test.
- Jangan mengerjakan ulang item yang sudah selesai di Batch 1–4.
- Semua perubahan kontrak harus memperbarui producer, consumer, dan test dalam commit yang sama.
- Semua perubahan schema harus menghasilkan migration yang di-commit bersama snapshot.
- Sebelum commit: `pnpm check && pnpm typecheck && pnpm test && pnpm build`.

### Yang sudah selesai (Batch 1–4) — jangan diulang

- URL notifikasi hanya `http/https` (click action, spin prize, media, avatar, channel).
- Widget: review/social/YouTube/inline benar-benar sampai ke payload.
- Analytics: conversion tidak lagi dihitung sebagai view; perbandingan periode memakai filter bot.
- Scheduler: `loopAfter` memakai ambang jumlah notifikasi; `closeForDays=0` tidak menjadi 1 hari.
- CSV export netral terhadap formula injection.
- Widget write endpoints (`visit`, `track`, `capture`, `spin/claim`) wajib Origin/Referer + rate limit.
- Consent: endpoint config ringan; payload/visitor ID/beacon baru dikirim setelah consent; revoke consent menghentikan scheduler, inline, dan capture.
- Spin-to-win: kode/URL hadiah tidak dikirim ke payload; draw dan claim di server, idempotent per visitor, rate limit claim.
- Ikon widget/dashboard memakai SVG (bukan emoji).
- Billing: `effectivePlanFor` dipakai; subscription tidak aktif jatuh ke Free; serve-time plan gate untuk tipe notifikasi; checkout kedua diarahkan ke portal; Price ID Portal dipetakan ke plan; `cancel_at_period_end` disimpan.
- Dedupe event unik per site; conversion goal idempotent via `dedupeKey`; goal conversion dipicu setelah event durable; worker webhook mencatat conversion.
- Bucket analytics mengisi hari kosong; bucket goal konsisten dengan total.
- Queue BullMQ punya retry/backoff + retensi job terbatas.
- Migration yang sudah ada: `0017_productive_darwin.sql` (`spin_claim`), `0018_flawless_wildside.sql` (dedupe per site + impression dedupe).

---

# Batch 5 — Integrasi, Webhook, dan Reliability

## R5.1 Enkripsi dan minimalkan secret integrasi

**Tujuan:** signing secret tidak lagi plaintext di database dan tidak dikembalikan ke member biasa.

**Masalah saat ini:**

- `config.secret` disimpan plaintext di `integration.config`.
- `toIntegration()` hanya membuang `credentials`; `config.secret` tetap dikirim ke API consumer.
- `GET /api/v1/integrations` hanya butuh `requireOrg`, sehingga member biasa bisa membaca secret dan memalsukan event `verified`.

**File:**

- `packages/contracts/src/integrations.ts` (`integrationConfigSchema`, `integrationSchema`, `create/update` schema).
- `apps/api/src/modules/integrations/services.ts` (`create`, `update`, `toIntegration`, `resolveForWebhook`, `recordDelivery`).
- `apps/api/src/modules/integrations/credentials.ts`.
- `apps/api/src/modules/integrations/router.ts`.
- `apps/web/src/features/integrations/components/connect-wizard.tsx`, `integrations-page.tsx`, `hooks/use-integrations.ts`.

**Langkah:**

1. Pisahkan schema input dan output:
   - `integrationConfigInputSchema`: boleh berisi `secret` dan `credentials` untuk create/update.
   - `integrationConfigPublicSchema`: **tidak** berisi `secret`/`credentials`; tambahkan `secretSet: boolean`.
   - `integrationSchema` memakai public config + `secretSet`.
2. Enkripsi `config.secret` dengan `CredentialCipher` yang sama:
   - Saat `create`: `secret: cipher.encrypt(secret)`.
   - Saat `update`: jika `patch.secret` ada, enkripsi; string kosong menghapus secret.
   - Saat `resolveForWebhook` / `recordDelivery`: dekripsi sebelum verifikasi signature; jika gagal dekripsi, kembalikan `null`/`unauthorized` dan set status `error` dengan pesan “Reconnect this integration.”
3. `toIntegration()` membuang `secret` dan `credentials`, mengembalikan `secretSet: Boolean(secret)`.
4. Tambah endpoint manager-only untuk reveal/rotate secret:
   - `GET /api/v1/integrations/:id/secret` → `{ secret: string | null }` hanya untuk `owner/admin`.
   - `POST /api/v1/integrations/:id/rotate-secret` → generate secret baru (untuk custom webhook), set status `pending`.
   - UI menampilkan tombol “Show secret”/“Rotate” hanya untuk manager.
5. **Data migration** untuk secret lama:
   - Buat script `apps/api/scripts/encrypt-integration-secrets.ts`.
   - Iterasi `integration`, jika `config.secret` tidak diawali `encv1.`, enkripsi lalu update.
   - Jalankan sekali setelah deploy: `pnpm --filter @repo/api exec tsx scripts/encrypt-integration-secrets.ts`.
   - Script harus idempotent dan tidak mencetak secret.
6. Pastikan log tidak pernah mencetak secret/credentials.

**Acceptance:**

- `GET /api/v1/integrations` tidak mengandung secret/credentials; hanya `secretSet`.
- Member biasa mendapat 403 saat meminta reveal/rotate.
- Signature tetap terverifikasi setelah secret dienkripsi.
- Database dump tidak lagi berisi secret plaintext.
- Rotasi secret membuat delivery lama ditolak dan status kembali `pending`.

**Test:**

- Unit: encrypt/decrypt secret; `toIntegration` tidak membocorkan secret; member tidak bisa reveal.
- Integrasi: create → resolveForWebhook → verify signature → delivery valid.
- Script: dua kali dijalankan tidak mengubah ciphertext yang sudah benar.

---

## R5.2 Simpan inbound signing secret untuk connector native

**Tujuan:** connector yang saat ini “connected” tetapi selalu 401 bisa benar-benar menerima event.

**Provider yang terdampak:** Shopify, WooCommerce, HubSpot, Calendly, Mailchimp, ActiveCampaign. Saat ini UI hanya menampilkan input signing secret untuk `webhook_secret`; provider `api_key`/`oauth` tidak menyimpan inbound secret.

**File:**

- `packages/contracts/src/integrations.ts` (field credentials per provider, `auth` metadata).
- `apps/web/src/features/integrations/components/connect-wizard.tsx`.
- `apps/api/src/modules/integrations/services.ts` (`create`/`update`/`verify`).
- `apps/api/src/modules/integrations/provider-api.ts` (subscribe/lookup).
- `apps/api/src/modules/ingest/services.ts` (wajib secret sebelum verifikasi).

**Langkah:**

1. Pisahkan konsep **API credential** dan **inbound signing secret**.
2. Untuk tiap provider:
   - **Shopify:** gunakan `SHOPIFY_API_SECRET` (server credential) atau app secret dari UI; subscribe webhook mengembalikan id; signature memakai secret app.
   - **WooCommerce:** minta user mengisi “Webhook secret” yang dipilih saat membuat webhook; simpan sebagai `config.secret` terenkripsi.
   - **HubSpot:** gunakan `HUBSPOT_CLIENT_SECRET` untuk v1/v3; UI tidak perlu input secret terpisah jika private app secret sama.
   - **Calendly:** buat signing key lebih dulu, simpan, lalu subscribe webhook dengan key tersebut.
   - **Mailchimp/ActiveCampaign:** pindahkan ke mode forwarded (`generated_secret`) atau implementasikan verifikasi asli; jangan tampilkan sebagai native jika tidak bisa.
3. Di `verify()`:
   - Jika `subscribe` mengembalikan `secret`, simpan terenkripsi.
   - Jika `subscribe` gagal, jangan set `connected`.
   - Jika secret tersedia tetapi API credential opsional tidak ada, status `pending`, bukan `error`.
4. Perbarui teks wizard agar tidak mengklaim “OAuth” jika belum ada flow OAuth.

**Acceptance:**

- Untuk setiap provider native, create → credentials → verify → kirim event berbentuk provider → event tersimpan `verified=true`.
- Provider tanpa signing secret tidak bisa berstatus `connected`.
- `Verify` menampilkan alasan yang benar (pending vs error).

**Test:**

- Satu test end-to-end per provider prioritas: Stripe, Shopify, WooCommerce, HubSpot, Calendly.
- Test bahwa `subscribe` gagal tidak menghasilkan `connected`.

---

## R5.3 Perbaiki algoritma verifikasi signature

**File:** `apps/api/src/modules/integrations/connectors.ts`.

**Langkah:**

1. **Calendly:** `parsePairs` saat ini `part.split("=")` memotong padding base64. Ganti dengan `indexOf("=")` atau parser yang mempertahankan seluruh value.
2. **HubSpot v1:** gunakan `createHash("sha256").update(secret + rawBody).digest("hex")`, bukan HMAC. Tambahkan dukungan v3 (`X-HubSpot-Signature-v3`, timestamp + HMAC) dengan toleransi replay.
3. **Wix:** Wix mengirim JWT di body, bukan header HMAC. Implementasikan verifikasi JWT dengan public key Wix; decode claims sebelum `mapToEvent`; atau pindahkan Wix ke mode forwarded dan ubah label katalog.
4. **Timestamp tolerance:** untuk Stripe, Calendly, Paddle, dan provider bertimestamp lain, tolak `t`/`ts` di luar ±5 menit.
5. **Generic webhook:** wajibkan `dedupeKey` atau timestamp+nonce yang ditandatangani; jika tidak ada, tolak event yang tidak punya idempotency.
6. Tambah test dengan header asli (termasuk padding base64, timestamp kedaluwarsa, signature salah).

**Acceptance:**

- Calendly/HubSpot/Wix lolos test signature dengan contoh header/body asli.
- Replay request dengan timestamp lama ditolak.
- Custom webhook tanpa `dedupeKey` ditolak atau diberi key turunan yang stabil.

---

## R5.4 Idempotensi dan replay protection webhook

**Tujuan:** webhook yang valid tetapi dikirim ulang tidak mengubah state dua kali.

**File:**

- `apps/api/src/modules/billing/stripe.ts`, `billing/router.ts`, `billing/services.ts`.
- `apps/api/src/modules/ingest/services.ts`, `connectors.ts`.
- `packages/db/src/schema.ts` (tabel baru `webhook_delivery`/`stripe_event`).
- `apps/worker/src/processors/webhook.ts`.

**Langkah:**

1. Tambah tabel `webhook_event`:
   ```ts
   export const webhookEvent = pgTable(
     "webhook_event",
     {
       id: text("id")
         .primaryKey()
         .$defaultFn(() => createId()),
       provider: text("provider").notNull(),
       eventId: text("event_id").notNull(),
       receivedAt: timestamp("received_at").notNull().defaultNow(),
     },
     (t) => [uniqueIndex("webhook_event_provider_event_key").on(t.provider, t.eventId)],
   );
   ```
2. Stripe billing:
   - Baca `event.id` dan `event.created`; simpan sebelum apply.
   - Tolak event yang `created` lebih lama dari state terakhir (bandingkan `subscription`/timestamp event).
   - Terapkan timestamp tolerance pada `verifyStripeSignature`.
3. Integration webhook:
   - Simpan `eventId` provider jika ada di payload/header; gunakan untuk idempotensi.
   - Untuk generic/Zapier, wajibkan `dedupeKey` atau header idempotency.
4. Hapus baris `webhook_event` lama secara berkala (retensi 30–90 hari) atau gunakan `createdAt` + index.
5. Jangan mengubah `integration.status` menjadi `error` sebelum signature valid (lihat R5.6).

**Acceptance:**

- Event Stripe yang sama dua kali hanya mengubah subscription sekali.
- Event webhook yang sama dua kali hanya membuat satu event/konversi.
- Event lama tidak menimpa state baru.

**Test:**

- Replay event Stripe `subscription.updated` dan `checkout.session.completed`.
- Dua delivery dengan dedupeKey sama.
- Event dengan timestamp kedaluwarsa ditolak.

---

## R5.5 Routing integrasi per site dan cegah duplikat

**Masalah:** `resolveForWebhook` memilih integrasi pertama berdasarkan `(organizationId, provider)` dan mengabaikan `config.siteKey`; user bisa membuat dua integrasi provider yang sama, tetapi hanya yang tertua menerima event.

**File:**

- `apps/api/src/modules/ingest/services.ts` (`processWebhook`, `resolveSite`).
- `apps/api/src/modules/integrations/services.ts` (`resolveForWebhook`, `create`).
- `packages/db/src/schema.ts` (constraint/index).
- `apps/web/src/features/integrations/components/integrations-page.tsx`.

**Langkah:**

1. Resolve integrasi dengan `(organizationId, provider, config.siteKey)` atau simpan `siteId` sebagai kolom eksplisit.
2. Tambah unique index `(organizationId, provider, siteKey)` bila satu provider hanya boleh satu koneksi per site.
3. Di UI, jika koneksi `(provider, site)` sudah ada, tampilkan “Manage” bukan “Set up”.
4. Validasi `config.siteKey` milik organisasi saat create/update.
5. Test dua site di organisasi yang sama, masing-masing punya integrasi provider sama; event site A tidak masuk site B.

**Acceptance:**

- Event untuk site B diverifikasi dengan integrasi site B.
- Tidak bisa membuat dua koneksi provider+site yang sama.
- Site key tenant lain ditolak.

---

## R5.6 Jangan ubah status integrasi dari request tanpa signature valid

**Masalah:** request junk ke `/ingest/v1/webhook/<provider>?site=<public siteKey>` bisa menulis `status=error` dan `lastError`.

**Langkah:**

1. Di `processWebhook`, hanya panggil `recordDelivery` untuk signature valid.
2. Untuk signature invalid, catat metrik/log terpisah (tanpa mengubah baris integrasi) dan rate-limit per IP.
3. `markDelivery` hanya dipanggil setelah verifikasi berhasil.

**Acceptance:**

- POST junk tidak mengubah `status`, `lastError`, atau `lastEventAt`.
- Dashboard tidak menampilkan outage palsu.

---

## R5.7 Perbaiki semantik “Verify”

**File:** `apps/api/src/modules/integrations/services.ts` (`verify`).

**Langkah:**

1. Jika `api.test` gagal tetapi signing secret sudah dikonfigurasi, status `pending` dengan pesan “Waiting for the first delivery.”
2. Jika `subscribe` gagal, status `error` (bukan `connected`).
3. Jika provider tidak punya API test, gunakan keberadaan secret untuk `pending`; `connected` hanya setelah delivery valid.
4. Simpan `lastCheckedAt` dan `lastError` secara konsisten.
5. Test untuk tiga kondisi: secret-only, subscribe gagal, delivery valid.

**Acceptance:**

- Status tidak pernah `connected` tanpa bukti delivery valid.
- User mendapat pesan yang bisa ditindaklanjuti.

---

## R5.8 SSRF hardening pada provider-api

**File:** `apps/api/src/modules/integrations/provider-api.ts`.

**Langkah:**

1. Batasi Shopify ke `^[a-z0-9-]+\.myshopify\.com$` (tanpa suffix trick).
2. Untuk WooCommerce `storeUrl` dan ActiveCampaign `accountUrl`:
   - Wajib `https:`.
   - Resolve DNS dan tolak private/loopback/link-local/metadata (`127.0.0.0/8`, `10/8`, `172.16/12`, `192.168/16`, `169.254/16`, `::1`, `fc00::/7`).
   - `redirect: "manual"`; jangan follow redirect.
   - Batasi ukuran response (mis. 256 KB).
3. Jangan tampilkan raw upstream body di `failure()`; tampilkan status + pesan pendek.
4. Tambah unit test dengan URL internal dan redirect ke internal.

**Acceptance:**

- Tidak ada request ke host internal/loopback/metadata.
- Error message tidak membocorkan detail internal.

---

## R5.9 Analytics flush atomik dan idempotent

**File:**

- `apps/worker/src/processors/analytics-aggregate.ts`.
- `packages/queue/src/index.ts` (`pushImpression`, `drainImpressions`, `BufferedImpression`).
- `packages/db/src/schema.ts` (jika perlu `bufferId`/`dedupeKey` unik di impression).

**Langkah:**

1. Tambah `id` (UUID) pada setiap buffered impression saat `pushImpression`.
2. Ganti `LRANGE` + `LTRIM` dengan `LMOVE`/`RPOPLPUSH` ke list `processing`, atau Lua script:
   - Pindahkan batch ke processing list.
   - Setelah insert sukses, hapus dari processing.
   - Jika gagal, kembalikan ke queue.
3. Bulk insert (`db.insert(impression).values(entries)`) dalam transaksi.
4. Jangan `catch {}`. Tangkap hanya FK violation (site deleted); error lain harus melempar untuk retry.
5. Simpan `dedupeKey = bufferId` pada impression (kolom sudah ada) dan gunakan `onConflictDoNothing()` agar worker yang overlap tidak menduplikasi.
6. Batasi ukuran batch; loop sampai buffer kosong atau time budget habis.
7. Tambah metrik: buffer depth, inserted, dropped, retried.

**Acceptance:**

- Crash setelah pindah ke processing tidak kehilangan data.
- Dua worker yang overlap tidak menduplikasi impression.
- DB transient error menyebabkan retry, bukan silent drop.

**Test:**

- Simulasi insert gagal transient → job retry.
- Simulasi dua flush bersamaan → jumlah impression tetap.
- Site dihapus → hanya baris site itu yang di-drop.

---

## R5.10 Worker reliability lanjutan

**File:** `apps/worker/src/worker.ts`, `packages/queue/src/index.ts`.

**Langkah:**

1. Tambah `worker.on("error", ...)` untuk setiap worker.
2. Pastikan `defaultJobOptions`/`JOB_OPTIONS` dipakai konsisten untuk webhook, counter, analytics (sudah sebagian).
3. Tambah retensi failed job + dokumentasi inspeksi (`/metrics` queue counts).
4. Opsional: dead-letter queue atau endpoint admin untuk retry failed jobs.
5. Test job invalid payload vs transient DB error.

**Acceptance:**

- Error koneksi Redis tidak menyebabkan unhandled `error`.
- Failed job terlihat di metrics dan tidak hilang tanpa jejak.

---

## R5.11 Body limit dan urutan rate limit ingest

**File:** `apps/api/src/app.ts`, `apps/api/src/modules/ingest/router.ts`, `apps/api/src/modules/ingest/rate-limit.ts`, `Caddyfile`.

**Langkah:**

1. Tambah Hono `bodyLimit`:
   - `/widget/*`: 32 KB.
   - `/ingest/*`: 256 KB.
   - `/api/*` umum: 1 MB.
2. Tambah `request_body max_size` di Caddy.
3. Untuk `/ingest/v1/event`, rate-limit berdasarkan IP **sebelum** lookup API key.
4. Untuk webhook, rate-limit berdasarkan IP + siteKey, bukan hanya siteKey publik.
5. Perbaiki `hitRateLimit` Redis agar `INCR` + `PEXPIRE` atomik (Lua atau `SET EX`).
6. Batasi `payload`/`fields` di kontrak (jumlah key, kedalaman, ukuran serialisasi).
7. Test 413, 429, dan invalid key tanpa DB lookup berlebihan.

**Acceptance:**

- Body besar ditolak sebelum parsing penuh.
- Attacker tidak bisa memblokir webhook legitimate hanya dengan menghabiskan bucket siteKey.
- Key rate-limit tidak bocor tanpa TTL.

---

## R5.12 Selaraskan `event.source` dengan kontrak

**File:** `packages/contracts/src/events.ts`, `apps/api/src/modules/ingest/services.ts`, `apps/api/src/modules/analytics/services.ts`, UI events feed.

**Langkah:**

1. Pilih salah satu:
   - Perluas `eventSources` ke seluruh provider integrasi; atau
   - Simpan `source = "webhook"` + kolom/field `provider` terpisah.
2. Jika memilih provider terpisah, tambah kolom `provider` di `event` + migration, update filter/export/UI.
3. Pastikan filter events feed menerima semua nilai yang benar-benar disimpan.

**Acceptance:**

- Tidak ada response yang melanggar tipe `EventSource`.
- UI bisa memfilter Paddle/Typeform/BigCommerce.

---

## R5.13 Test integrasi/ingest yang wajib ditambah

- Route-level `/ingest` dan `/widget` (bukan hanya service).
- Signature asli untuk Calendly, HubSpot, Wix, Ecwid, Recharge, Kajabi, Thinkific, Memberful, Lemon Squeezy.
- Replay/timestamp.
- Cross-tenant dedupe.
- Multi-integration routing.
- Member tidak bisa membaca secret.
- Body limit/rate limit.
- Worker invalid payload, retry, concurrency.

---

# Batch 6 — Product Correctness, Tenant UX, dan Privacy

## R6.1 Team memakai organisasi aktif, bukan organisasi pertama

**Masalah:** `loadTeam()` memanggil `setActive(organizations.list()[0])` setiap load; user multi-org bisa melihat/mengubah workspace yang salah.

**File:**

- `apps/web/src/features/team/services.ts`.
- `apps/web/src/features/profile/account.ts`.
- `apps/web/src/features/app-shell/app-shell.tsx`.
- `apps/web/src/features/auth/*`.

**Langkah:**

1. Baca `session.activeOrganizationId` dari `/session` (atau `getFullOrganization()` tanpa `setActive`).
2. Hanya panggil `setActive` jika session belum punya organisasi aktif.
3. Tambah organization switcher di app shell (owner/admin/member daftar org).
4. `getActiveOrganization()` di profile memakai org aktif yang sama.
5. Setelah `acceptInvitation`, panggil `setActive` ke org hasil invitation.
6. Test user dengan dua org: team/profile/rename memakai org yang dipilih.

**Acceptance:**

- Membuka `/team` tidak mengubah org aktif.
- Invite/remove/rename terjadi di org yang benar.
- Ada cara berpindah org.

---

## R6.2 Kembali ke invitation setelah login

**Masalah:** user yang belum login dikirim ke `/login` tanpa return path; setelah login masuk ke dashboard, invitation tetap pending.

**File:**

- `apps/web/src/features/auth/guard.ts`.
- `apps/web/src/routes/login.tsx`, `register.tsx`, `verify-email.tsx`.
- `apps/web/src/routes/accept-invitation.$invitationId.tsx`.
- `apps/web/src/features/auth/hooks/use-auth.ts`.

**Langkah:**

1. `ensureAuthenticated` menerima `redirect` (path saat ini) dan menyimpan `?redirect=...` saat redirect ke login.
2. Login/register/verify-email membaca `redirect` dan mengarahkan kembali setelah sukses.
3. `accept-invitation` memanggil `setActive` ke org hasil accept.
4. Validasi `redirect` hanya path internal (`startsWith("/")`, bukan `//`).
5. Test alur invite → login → accept.

**Acceptance:**

- Setelah login, user kembali ke halaman invitation dan bisa accept.
- Tidak ada open redirect.

---

## R6.3 Test event tidak menjadi social proof

**Masalah:** `/sites/:id/test-event` menyisipkan event `purchase` normal; member biasa bisa memicunya; event `payload.test` tidak dikecualikan dari payload publik/analytics.

**File:**

- `apps/api/src/modules/sites/router.ts` (`/test-event`).
- `apps/api/src/modules/sites/services.ts` (`sendTestEvent`).
- `apps/api/src/modules/widget/services.ts` (latest event/counter).
- `apps/api/src/modules/analytics/services.ts`.
- `apps/web/src/features/sites/components/sites-page.tsx`, overview.

**Langkah:**

1. Batasi `/test-event` ke `owner/admin` (`requireRole`).
2. Tandai event dengan `payload.test = true` (sudah) dan **exclude** dari:
   - `latestEvent`/counter di widget,
   - analytics summary/events feed default,
   - goal conversion.
3. Atau jangan simpan ke DB: kirim event uji ke browser melalui endpoint preview khusus yang tidak dipersist.
4. UI: tampilkan banner “Test event — not visible to visitors.”
5. Test: test event tidak muncul di payload publik/analytics.

**Acceptance:**

- Test event hanya terlihat oleh owner/admin di preview.
- Member biasa mendapat 403.
- Tidak mengotori analytics.

---

## R6.4 Hapus akun/workspace dengan cleanup lengkap

**Masalah:** `deleteUser` aktif, tetapi tidak ada cleanup organization/sites/events/subscription; owner terakhir bisa meninggalkan org yatim + data PII + Stripe subscription.

**File:**

- `apps/api/src/modules/auth/auth.ts` (`user.deleteUser`, `beforeDelete`/`afterDelete`).
- `packages/db/src/schema.ts`.
- `apps/api/src/modules/billing/services.ts`/`stripe.ts`.
- `apps/web/src/features/profile/components/security-settings.tsx`.

**Langkah:**

1. Sebelum delete:
   - Cek apakah user adalah owner terakhir dari org.
   - Jika ya, wajibkan transfer ownership atau hapus workspace.
2. Setelah delete:
   - Hapus organization yang user miliki sendirian (cascade sites/events/notifications/integrations/goals/domain settings/spin claims).
   - Batalkan subscription Stripe (jika ada) sebelum menghapus.
   - Hapus cache/widget payload untuk site yang dihapus.
3. Tambah endpoint/UI “Delete workspace” dan “Leave workspace” dengan konfirmasi teks.
4. Update copy peringatan agar akurat.
5. Test: owner terakhir delete → org/sites/events/subscription hilang; member delete → hanya membership hilang.

**Acceptance:**

- Tidak ada org tanpa member.
- Tidak ada Stripe subscription aktif untuk org yang dihapus.
- Data PII tidak tertinggal.

---

## R6.5 UI edit site

**Masalah:** `useUpdateSiteMutation` dan `PATCH /sites/:id` ada, tetapi tidak ada UI untuk rename/domain.

**File:**

- `apps/web/src/features/sites/components/sites-page.tsx`.
- `apps/web/src/features/sites/hooks/use-sites.ts`.

**Langkah:**

1. Tambah dialog “Edit site” dengan field name/domain.
2. Pakai `useUpdateSiteMutation`; invalidasi `sitesQueryOptions` dan detail site.
3. Tampilkan error per-field (pola `CreateSiteDialog`).
4. Hanya owner/admin yang melihat aksi edit.
5. Test normalisasi domain dan error.

**Acceptance:**

- Site bisa di-rename dan domain diperbaiki.
- Member tidak melihat tombol edit.

---

## R6.6 Ganti email, export akun, dan purge yang lengkap

**File:**

- `apps/api/src/modules/auth/auth.ts` (Better Auth `changeEmail` + verification email).
- `packages/contracts/src/profile.ts`.
- `apps/api/src/modules/profile/*`, `apps/api/src/modules/sites/*`.
- `apps/web/src/features/profile/*`.

**Langkah:**

1. Aktifkan `changeEmail` Better Auth:
   - Kirim verifikasi ke email baru.
   - Setelah verifikasi, update email + `emailVerified`.
   - Jangan izinkan perubahan tanpa password/re-auth.
2. Tambah UI “Change email” di security settings.
3. Tambah export akun-level:
   - `GET /profile/export` atau `/api/v1/account/export`.
   - Isi: profile, daftar site, events, impressions agregat, goals, integrations (tanpa secret).
   - Format JSON (default) dan CSV untuk events.
4. Perluas purge:
   - Opsi `includeAnalytics=true` untuk menghapus impression/anonymized analytics.
   - Dokumentasikan bahwa default hanya events.
5. Test perubahan email, export tidak membocorkan secret, purge menghapus sesuai scope.

**Acceptance:**

- Email login bisa diganti dengan verifikasi.
- Export berisi data milik user/org saja.
- Purge dengan `includeAnalytics` menghapus impression.

---

## R6.7 Pixel verification yang tidak bisa di-spoof

**Masalah:** payload request tanpa Origin tetap menandai `pixelVerifiedAt`; UI mengabaikan `recentlyActive`; verifikasi lama tidak pernah kedaluwarsa.

**File:**

- `apps/api/src/modules/widget/services.ts` (`getPayload`, `originAllowed`).
- `apps/api/src/modules/sites/services.ts` (`verify`).
- `apps/web/src/features/sites/components/sites-page.tsx`.

**Langkah:**

1. Hanya set `pixelVerifiedAt` jika `origin`/`referer` ada dan host cocok dengan domain site.
2. Tambah opsi verifikasi nonce:
   - `POST /sites/:id/verify` menghasilkan nonce jangka pendek.
   - Snippet/pixel mengirim nonce saat payload; server memverifikasi.
3. UI memakai `recentlyActive` dan `pixelVerifiedAt` untuk badge:
   - Verified + active < 10 menit → “Active”.
   - Verified tetapi lama → “Not detected recently”.
4. Tambah job/age-out yang membersihkan `pixelVerifiedAt` setelah N hari tanpa payload (opsional).
5. Test request tanpa Origin tidak memverifikasi; request dari domain lain tidak memverifikasi.

**Acceptance:**

- `curl` tanpa Origin tidak bisa memverifikasi site.
- Badge mencerminkan aktivitas terbaru.

---

## R6.8 Onboarding memakai semua site

**Masalah:** Overview memakai `sites[0]` untuk notifications/activation; user dengan notifikasi di site lain melihat checklist salah.

**File:** `apps/web/src/features/overview/components/overview-page.tsx`, `apps/web/src/features/analytics/*`.

**Langkah:**

1. Agregasi notifikasi/aktivasi dari semua site, atau pilih site yang punya notifikasi/aktivitas.
2. Backend: tambah endpoint activation org-level atau loop per site dengan batas.
3. Test user dengan 2 site: notifikasi di site kedua tetap dihitung selesai.

**Acceptance:**

- Checklist selesai jika salah satu site memenuhi.
- Quick stats tidak hanya site pertama.

---

## R6.9 Polish runtime notifikasi yang belum selesai

**File:**

- `apps/api/src/modules/widget/services.ts`.
- `apps/widget/src/index.ts`, `shadow.ts`, `render/notification.ts`, `scheduler.ts`.
- `packages/contracts/src/notifications.ts`.
- `apps/web/src/features/notifications/components/notifications-page.tsx`, `notification-preview.tsx`.

**Langkah:**

1. **Posisi per notifikasi:** buat shadow host per posisi atau pindahkan stack saat menampilkan notifikasi; jangan memakai `floating[0]` untuk semua.
2. **Animasi/ukuran/font:** terapkan `data-animation`, `data-size`, `data-font` di semua renderer (card, bar, popup, spin); tambah CSS `fade`/`scale`/`none`.
3. **Media:** panggil `resolveMedia()` untuk semua tipe yang relevan, bukan hanya `recent_sales`; tentukan prioritas avatar review vs pinned image.
4. **Validasi tipe:** `notificationConfigSchema.superRefine` atau router:
   - `countdown` wajib `endsAt` valid.
   - `review` wajib minimal 1 review valid.
   - `social_counter`/`youtube` wajib config.
   - `spin_to_win` wajib minimal 2 prize dengan code/url.
   - `bar`/`popup` hanya posisi yang sesuai.
5. **Live visitors:** hormati `dataSource` atau jelaskan bahwa live count selalu `visit`.
6. **Social/YouTube live refresh:** implementasikan `fetchYoutubeStat` dan provider social, atau hapus klaim “live” di UI.
7. **Preview fidelity:** preview memakai variant/translation/fallback/transform/countdown/stock/media/click action; timeAgo jangan hardcode.
8. **Translation editor:** gunakan id stabil (bukan locale sebagai key) agar fokus tidak hilang; validasi locale 2–12 karakter.
9. **`dataSource.filter` lama:** migrasikan ke `filters` atau hapus dukungan dan bersihkan baris lama.
10. **Counter cache key:** sertakan source/filter/versi konfigurasi agar edit tidak menampilkan count lama.

**Acceptance:**

- Semua opsi editor tersimpan, ter-preview, dan ter-render.
- Notifikasi tanpa config wajib tidak bisa dipublish.
- Mixed positions tampil benar.

---

## R6.10 A/B testing: koreksi statistik dan variant style

**File:** `apps/api/src/modules/analytics/services.ts`, `apps/api/src/modules/widget/services.ts`, `apps/web/src/features/notifications/components/notifications-page.tsx`.

**Langkah:**

1. Terapkan koreksi multiple comparisons (Holm/Bonferroni) untuk 3–5 varian.
2. Syarat `enoughData` juga memakai minimum clicks, bukan hanya views.
3. `clickUrl` membaca `variant.style.clickAction` jika ada.
4. UI bisa mengatur style per variant, atau hapus dukungan style variant dari kontrak.
5. Test dengan 3 varian dan sampel kecil → tidak “significant” palsu.

**Acceptance:**

- Signifikansi tidak menyesatkan untuk multi-varian.
- Variant click action bekerja.

---

## R6.11 Cache targeting yang benar

**File:** `apps/api/src/modules/widget/targeting.ts`, `apps/api/src/modules/widget/services.ts`.

**Langkah:**

1. Sertakan **semua** parameter yang dipakai `display.utm` (bukan hanya `utm_*`) dalam cache key.
2. Sertakan hash full referrer jika aturan referrer `contains`/`regex`.
3. Atau bypass cache ketika aturan custom/referrer path aktif.
4. Perbarui test yang saat ini mengunci perilaku cache key yang tidak lengkap.
5. Test dua visitor dengan nilai param/referrer berbeda tidak menerima payload yang sama.

**Acceptance:**

- Targeting tidak bocor antar visitor karena cache.
- Cache tetap dipakai untuk aturan sederhana.

---

## R6.12 CSRF/Origin middleware untuk API custom

**Masalah:** session cookie `SameSite=None`; route `/api/v1/*`, `/profile`, `/users` tidak memeriksa Origin. Setelah API pindah ke domain sendiri, ini tetap perlu dipertahankan.

**File:** `apps/api/src/app.ts`, `apps/api/src/modules/auth/middleware.ts`.

**Langkah:**

1. Tambah middleware untuk method tidak aman (`POST/PUT/PATCH/DELETE`) pada:
   - `/api/v1/*`, `/profile`, `/users`, `/session`.
2. Validasi `Origin`/`Sec-Fetch-Site` terhadap `config.clientOrigins`.
3. Pengecualian:
   - `/api/v1/billing/webhook` (Stripe signature).
   - `/api/auth/*` (Better Auth sudah punya origin check).
4. Untuk JSON route, wajibkan `Content-Type: application/json`; tolak `text/plain`.
5. Tambah test cross-origin POST ditolak, same-origin diterima, webhook tetap diterima.
6. Jangka panjang: jika API dan web satu site, pertimbangkan `SameSite=Lax` dan hapus kebutuhan None.

**Acceptance:**

- Cross-site form/fetch tidak bisa memutasi state.
- Webhook Stripe tetap valid.

---

## R6.13 Gating fitur premium (keputusan produk)

**Masalah:** plan gate hanya tipe notifikasi; A/B, inline, integrations, dan custom CSS belum dicek. PRD menempatkan beberapa di Growth.

**Langkah:**

1. Konfirmasi keputusan produk: fitur mana yang masuk plan mana.
2. Jika disetujui, tambah flag di `planLimits`:
   ```ts
   features: {
     abTesting: boolean;
     inline: boolean;
     integrations: boolean;
     customCss: boolean;
   }
   ```
3. Terapkan di:
   - create/update notifikasi (`config.variants`, `config.inlineSelector`),
   - serve-time widget (filter/disable),
   - create integrasi,
   - payload `customCss`.
4. UI menyembunyikan/menonaktifkan kontrol dengan CTA upgrade.
5. Test downgrade: fitur premium berhenti disajikan.

**Acceptance:**

- Tidak ada fitur premium yang bisa dipakai di Free setelah downgrade.
- Perilaku sesuai keputusan bisnis yang dicatat.

---

## R6.14 Hardening operasional

**File:** `apps/api/src/app.ts`, `apps/api/src/config.ts`, `apps/api/src/modules/auth/auth.ts`, `docker-compose.yaml`, `.env.example`.

**Langkah:**

1. `/metrics` jangan publik: lindungi dengan admin auth atau allowlist proxy.
2. Tambah `TRUSTED_PROXIES` dan gunakan di Better Auth `advanced.ipAddress.trustedProxies` + ekstraksi IP widget.
3. Compose: gunakan `env_file` atau teruskan `RESEND_*`, `STRIPE_*`, `PUBLIC_API_URL`, `CREDENTIALS_SECRET`, `MAIL_FROM_*`.
4. Validasi production: `PUBLIC_API_URL` wajib HTTPS dan bukan localhost.
5. Rate limit auth: pertimbangkan Redis/secondary storage agar multi-instance konsisten.
6. Pin image Docker dan jalankan sebagai non-root (opsional tapi disarankan).

**Acceptance:**

- Metrics tidak bisa diakses publik.
- IP/XFF tidak bisa dipalsukan untuk membypass blocked IP.
- Deploy production tidak kehilangan env penting.

---

## R6.15 Index dan query hot-path

**File:** `packages/db/src/schema.ts`, `apps/api/src/modules/widget/services.ts`, `apps/api/src/modules/analytics/services.ts`, `apps/api/src/modules/goals/services.ts`, `apps/worker/src/processors/counter-recompute.ts`.

**Langkah:**

1. Tambah unique index `(organizationId, userId)` pada `Member`; index `Session.userId`, `Account.userId`, `TwoFactor.userId`, `Verification.identifier`.
2. Index `integration(organizationId, provider)`; `notification(siteId, isActive)`.
3. Index `impression(siteId, kind, createdAt)`, `(siteId, refId, kind, createdAt)`.
4. Index `event(siteId, type, occurredAt)`.
5. Batch query widget payload (latest event/counter) alih-alih per notifikasi.
6. Counter recompute: satu grouped query, bukan N query.
7. Goal stats: lakukan attribution di SQL atau batasi ukuran window.
8. Review migration dan ukur sebelum/sesudah.

**Acceptance:**

- Tidak ada full scan pada hot path utama.
- Query count per payload tidak tumbuh linear dengan jumlah notifikasi.

---

## R6.16 Test yang belum ada

1. Widget test runner (Vitest + happy-dom/jsdom) dan test:
   - scheduler (`loopAfter`, timing, close/snooze 0),
   - renderer (SVG, media, animation, mixed positions),
   - URL scheme, consent, spin.
2. Route-level ingest/widget tests.
3. Worker failure/retry/concurrency.
4. Billing status/portal/double checkout.
5. Team multi-org + invitation return.
6. Account deletion cleanup.
7. Analytics bucket/referrer/UTM cache.

---

# Batch 7 — Verifikasi, Rollout, dan Definition of Done

## R7.1 Gate verifikasi wajib

```sh
pnpm check
pnpm typecheck
pnpm test
pnpm build
```

Tambahan untuk perubahan widget/worker:

```sh
pnpm --filter @repo/widget build
pnpm --filter @repo/worker test
```

## R7.2 Migration

```sh
pnpm db:generate
# review SQL + snapshot
pnpm db:migrate
```

Yang harus ada setelah Batch 5–6:

- tabel/kolom webhook idempotency,
- perubahan secret integrasi (jika ada kolom baru),
- index tambahan,
- cleanup org/account (jika ada tabel baru).

Jangan menulis ulang migration yang sudah diterapkan. Untuk production, gunakan `pnpm db:deploy`/Compose yang menjalankan migration sebelum API start.

## R7.3 Env production yang wajib

```env
NODE_ENV="production"
BETTER_AUTH_URL="https://api.tacto.software"
CLIENT_ORIGINS="https://app.tacto.software"
PUBLIC_API_URL="https://api.tacto.software"
DATABASE_URL="..."
REDIS_URL="..."
BETTER_AUTH_SECRET="..."
CREDENTIALS_SECRET="..."
RESEND_API_KEY="..."
MAIL_FROM_EMAIL="no-reply@tacto.software"
STRIPE_SECRET_KEY="..."
STRIPE_WEBHOOK_SECRET="..."
STRIPE_PRICE_*="..."
```

- Jangan sertakan `http://localhost:3000` di `CLIENT_ORIGINS` production.
- Pastikan domain pengirim Resend + SPF/DKIM/DMARC sudah verified.

## R7.4 Smoke test production

1. Register → email verifikasi → login.
2. Forgot password → reset → login.
3. Buat site → install pixel → verify → kirim test event (tidak tampil publik).
4. Buat notifikasi premium di plan yang sesuai → tampil di site.
5. Downgrade/cancel → notifikasi premium berhenti.
6. Integrasi Stripe/Shopify: connect → verify → kirim event → tampil di events feed.
7. Analytics: impressions/CTR/trend/breakdown/export.
8. Goal: event dan URL conversion; tidak menggandakan saat retry.
9. Consent: sebelum consent tidak ada beacon; setelah grant ada; revoke berhenti.
10. Spin: claim sekali per visitor; kode tidak ada di payload.
11. Team: invite → login → accept → org aktif benar.
12. Hapus akun/workspace: data dan subscription bersih.

## R7.5 Rollback

- Migration Batch 5–6 harus additive atau aman (drop unique global → composite, tambah index/tabel).
- Jangan menghapus kolom lama sampai kode lama tidak dipakai.
- Simpan backup DB sebelum migration production.
- Rollback kode tanpa rollback migration harus tetap kompatibel (kode lama tidak membaca kolom baru).

## R7.6 Definition of Done

- [ ] Semua task Batch 5 selesai dan test-nya ada.
- [ ] Semua task Batch 6 selesai dan test-nya ada.
- [ ] Tidak ada secret plaintext/terekspos.
- [ ] Webhook retry/replay/idempotency teruji.
- [ ] Analytics tidak lagi menghitung conversion sebagai view.
- [ ] Billing tidak memberikan fitur paid untuk status non-active.
- [ ] Consent dan blocked IP ditegakkan di semua endpoint tracking.
- [ ] `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm build` hijau.
- [ ] Migration direview dan diterapkan.
- [ ] Smoke test production lulus.
- [ ] Dokumentasi/env/decision diperbarui.

---

## 7. Keputusan produk yang perlu dikonfirmasi

1. **Plan gating:** apakah A/B, inline, integrations, dan custom CSS masuk Growth/Agency? PRD menyarankan ya, tetapi kode saat ini belum membatasi.
2. **Review type:** produk pernah menghapus Review lalu menambahkannya lagi; konfirmasi apakah tetap ada.
3. **Auto sign-in setelah verifikasi email:** link verifikasi saat ini membuat session. Jika risiko link bocor dianggap tinggi, matikan auto sign-in atau perpendek TTL lagi.
4. **Test event:** apakah harus benar-benar dipersist (dengan flag) atau hanya preview browser-local.
5. **Hapus akun owner terakhir:** wajib transfer ownership atau langsung hapus workspace?
6. **Timezone analytics:** UTC atau timezone per site?
7. **Resend region/EU:** apakah perlu `RESEND_API_URL` region EU.
8. **Retensi data:** berapa lama events/impressions/webhook idempotency disimpan?

Catat keputusan yang memengaruhi arsitektur di `docs/decision/` sesuai template.

---

## 8. Log eksekusi (19 Oktober 2026)

### Selesai

- **R5.1** Secret integrasi dienkripsi dengan `CredentialCipher`; list response hanya `secretSet`; reveal/rotate manager-only; script `encrypt-integration-secrets.ts` untuk data lama.
- **R5.2 (sebagian)** UI menerima inbound signing secret untuk provider non-generated; Shopify/HubSpot memakai app secret server sebagai fallback. Connector WooCommerce/Calendly/Mailchimp/ActiveCampaign tetap membutuhkan secret yang dipaste.
- **R5.3** `parsePairs` tidak lagi memotong padding base64; HubSpot v1 memakai SHA-256 (bukan HMAC); Stripe/Calendly/Paddle menolak timestamp >5 menit; Wix dipindahkan ke mode forwarded (Zapier/Make) sampai verifikasi JWT diimplementasikan.
- **R5.4 (Stripe)** Tabel `webhook_event` + `claimWebhookEvent` membuat event Stripe idempotent. Integration event tetap memakai dedupeKey per site.
- **R5.5** Resolusi integrasi memakai `siteKey`; tidak lagi fallback ke integrasi tertua untuk site lain.
- **R5.6** Signature invalid tidak mengubah status/lastError integrasi.
- **R5.7** Verify: secret-only → pending; subscribe gagal → error; `connected` hanya setelah delivery valid.
- **R5.8** SSRF guard (HTTPS, private IP/DNS, redirect manual, Shopify host ketat).
- **R5.9** Analytics flush memakai processing list + ack/requeue + bulk insert + hanya drop FK violation + dedupe id.
- **R5.10** Worker `error` listener; job retry/backoff/retention sudah aktif.
- **R5.11** Body limit widget/ingest/api, Caddy `request_body`, rate limit per IP sebelum lookup, Redis limiter atomik, in-memory limiter prune.
- **R5.12** `eventSources` mencakup seluruh katalog integrasi.
- **R6.1 (sebagian)** Team/profile memakai active organization; organization switcher ditambahkan di sidebar.
- **R6.2** Redirect internal setelah login/verifikasi; invitation kembali ke halaman accept.
- **R6.3** `/test-event` manager-only; event `payload.test` dikecualikan dari payload publik, counter, dan events feed.
- **R6.4** Hook `beforeDelete` menghapus workspace milik sole owner beserta site/integrasi/subscription (pembatalan Stripe belum, karena subscription id tidak disimpan).
- **R6.5** Dialog edit site (nama/domain).
- **R6.6 (sebagian)** Ganti email dengan konfirmasi ke email lama; purge events mendukung `includeAnalytics=true`. Export akun-level belum.
- **R6.7** Pixel verification hanya dari Origin/Referer nyata; UI memakai `recentlyActive`.
- **R6.8** Onboarding memakai semua site, bukan hanya site pertama.
- **R6.9 (sebagian)** Host per posisi, animasi/ukuran/font, pinned media semua tipe, validasi tipe saat create, variant click action, translation key belum diperbaiki.
- **R6.10** Bonferroni + minimum clicks untuk signifikansi A/B.
- **R6.11** Cache key memuat semua param + full referrer.
- **R6.12** CSRF/Origin middleware untuk API custom (Stripe webhook & Better Auth dikecualikan; test env bypass).
- **R6.14 (sebagian)** `/metrics` token/disabled production, `TRUSTED_PROXIES`, Compose `env_file`.
- **R6.15** Index Member/Session/Account/TwoFactor/Verification/integration/notification/impression/event.
- Migration baru: `0019_perfect_shooting_star.sql` (`webhook_event`), `0020_luxuriant_black_bird.sql` (index).

### Belum selesai / keputusan produk

- **R5.2 penuh:** mapping signature asli Mailchimp/ActiveCampaign; Wix JWT verification.
- **R5.4 integration-level:** idempotency berbasis event id provider di luar dedupeKey.
- **R6.1:** organization switcher sudah ada; audit multi-org end-to-end belum ditest.
- **R6.4:** pembatalan Stripe saat workspace dihapus belum (perlu menyimpan subscription id).
- **R6.6:** account-level export JSON/CSV belum.
- **R6.9:** preview fidelity (variant/translation/countdown/media), live social/YouTube refresh, perbaikan fokus input translation.
- **R6.13:** gating A/B/inline/integrations/custom CSS menunggu keputusan produk.
- **R6.16:** widget test runner, route-level ingest tests, analytics flush concurrency tests.
- **R5.13:** test signature Calendly/HubSpot/Wix/Replay/BodyLimit belum lengkap.

### Verifikasi

- `pnpm typecheck` ✅
- `pnpm check` (boundaries/env/lint/format) ✅
- API **147 tests** ✅
- Worker **7 tests** ✅
- Contracts **16 tests** ✅
- Widget build **9.93 kB gzip** ✅
- Web build ✅

### Tambahan (lanjutan)

- **R6.6** Account-level export selesai: `GET /profile/export` + tombol “Download JSON” di profil; secret/credentials integrasi tidak disertakan.
- **R6.9** Input translation memakai key posisi sehingga fokus tidak hilang saat locale diketik.
- **R6.16** Widget sekarang punya `vitest` + test `safe-url` (scheme berbahaya ditolak).
- **R6.1** Organization switcher ditambahkan di sidebar.

Sisa yang masih membutuhkan keputusan produk atau pekerjaan lanjutan: R6.13 (gating fitur per plan), R5.2 penuh (Mailchimp/ActiveCampaign/Wix JWT), R5.4 event-id idempotency integrasi, R6.4 pembatalan Stripe saat workspace dihapus, dan test route-level/worker concurrency.
