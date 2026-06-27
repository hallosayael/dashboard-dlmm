# DLMM PnL Dashboard

Dashboard bergaya terminal/TUI untuk melihat hasil trading **DLMM** (posisi yang
sudah closed) dari sebuah wallet Solana. Read-only — cukup tempel public key,
tanpa connect wallet. Responsive (rapi di desktop & HP), tanpa database, tanpa API key.

## Fitur

- **Halaman awal**: tempel alamat wallet Solana (read-only) atau klik **Lihat demo**.
- **Toggle mata uang `SOL / USD / IDR`** (global) — semua angka ikut berubah.
- **Toggle rentang `7D / 30D / all`** (global, default **30D**) — memfilter
  summary, breakdown, dan chart.
- **Toggle tampilan `chart / calendar`**:
  - **Equity curve** — PnL kumulatif sepanjang waktu (hijau saat naik, merah saat turun).
  - **Calendar heatmap** — realized PnL per hari, navigasi per bulan.
- **Summary**: net PnL, total fees, win rate, best & worst.
- **PnL breakdown**: `fees` vs `price/IL` (di mana `price/IL = net − fees`) →
  kelihatan seberapa besar fee menutup impermanent loss.
- **Tabel posisi closed** (15 baris/halaman, prev/next; di HP jadi kartu).
- Gaya TUI: statusline + segmented control, flag ikut ke prompt (`--denom`, `--range`),
  kursor blok, key-hints (dekoratif).

---

## Sumber data (tanpa database, tanpa API key)

Membaca dari **API resmi Meteora** (endpoint yang sama dipakai bengbeng.fun) —
data PnL/fee/deposit **sudah dihitung Meteora** (harga historis + fee benar):

1. `GET /portfolio?user={wallet}&days_back=365` — daftar pool wallet (+ nama pair).
2. `GET /positions/{pool}/pnl?user={wallet}&status=closed` — **posisi closed
   individual** per pool (createdAt, closedAt, `pnlSol`, fee, deposit).

Base: `https://dlmm.datapi.meteora.ag`

Konversi mata uang (dihitung dari nilai SOL, di-fetch saat load):
- **USD** — harga SOL dari `https://lite-api.jup.ag/price/v3`.
- **IDR** — kurs USD→IDR dari `https://open.er-api.com`.

> Catatan: USD/IDR adalah konversi **mark-to-market harga sekarang** (bukan harga
> saat posisi ditutup) dan **di-update saat halaman di-reload**. Nilai SOL adalah
> angka realized yang sebenarnya.

---

## Batasan

- **`days_back` dibatasi 365 hari** oleh API Meteora — posisi lebih tua tak terbaca.
- Kalender & nilai harian memakai timezone **GMT+7** (ubah `TZ` di `components/Calendar.js`).
- Toggle rentang hanya mempengaruhi summary/breakdown/chart; **kalender** pakai
  navigasi bulan sendiri, **tabel** menampilkan semua posisi (dengan pagination).
- USD/IDR perkiraan (mark-to-market, lihat catatan di atas).

---

## Struktur

```
app/
  layout.js                root layout + metadata + viewport
  page.js                  orchestrator: landing <-> dashboard
  globals.css              styling + responsive
  api/positions/route.js   API route (server) -> getWalletData(wallet)
components/
  Landing.js               halaman input wallet
  Dashboard.js             statusline + toggle + summary + breakdown + tabel/kartu
  Chart.js                 equity curve (PnL kumulatif)
  Calendar.js              kalender heatmap PnL harian (GMT+7)
lib/
  meteora.js               orchestrator + demo data
  portfolio.js             fetch posisi closed per-posisi (Meteora)
  prices.js                harga SOL (Jupiter) + kurs IDR (open.er-api.com)
  http.js                  fetch timeout + concurrency helper
  format.js                helper format + konversi mata uang
```
