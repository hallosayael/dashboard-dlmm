# DLMM PnL Dashboard

Dashboard bergaya terminal/TUI untuk melihat hasil trading **DLMM** (posisi yang
sudah closed) dari sebuah wallet Solana. PnL dalam **SOL**. Responsive (desktop & HP).

Fitur:
- Halaman awal untuk **tempel alamat wallet** (read-only, cukup public key).
- Ringkasan: net PnL, total fees, win rate, avg/posisi, best & worst.
- Grafik **PnL per posisi** + **kalender heatmap** PnL harian (ganti bulan).
- Tabel posisi (di HP jadi kartu).
- Tombol **Lihat demo** (data contoh).

---

## Sumber data (tanpa database, tanpa API key)

Membaca dari **portfolio API resmi Meteora** (endpoint yang sama dipakai
bengbeng.fun):

- `GET https://dlmm.datapi.meteora.ag/portfolio?user={wallet}&days_back=365`
  → posisi closed per pool, dengan `pnlSol`, `totalFeeSol`, `totalDepositSol`,
  `lastClosedAt` — semua sudah dihitung Meteora (harga historis + fee benar).
- `https://lite-api.jup.ag/price/v3` → harga SOL (hanya untuk tampilan footer).

Tidak perlu Helius / RPC / API key apa pun.

---

## Deploy ke Vercel

1. Push folder ini ke repo GitHub.
2. [vercel.com](https://vercel.com) → **Add New… → Project** → import repo → **Deploy**.
   (Tanpa environment variable.)

### Domain custom (mis. `dlmm.my.id`)
Project → **Settings → Domains** → add domain → pasang record DNS yang
ditunjukkan Vercel (A `@` → `76.76.21.21`, CNAME `www` → `cname.vercel-dns.com`).

---

## Jalankan lokal

```bash
npm install
npm run dev      # http://localhost:3000
```

Butuh Node.js 18+.

---

## Batasan

- **Agregasi per pool** (sesuai endpoint Meteora): kalau satu pool dibuka &
  ditutup berkali-kali, dijumlah jadi satu baris. Total posisi mentah bisa lebih
  banyak dari jumlah baris pool.
- **`days_back` dibatasi 365 hari** oleh API Meteora — posisi lebih tua tak terbaca.
- Kolom **age** tidak tersedia (endpoint hanya memberi tanggal close, bukan buka)
  → ditampilkan "—".
- Tanggal di kalender = `lastClosedAt` per pool (GMT+7).

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
  Dashboard.js             ringkasan + bars + tabel/kartu
  Calendar.js              kalender heatmap PnL harian (GMT+7)
lib/
  meteora.js               orchestrator + demo data
  portfolio.js             fetch portfolio Meteora (sumber utama)
  prices.js                harga SOL (Jupiter, untuk footer)
  http.js                  fetch timeout + concurrency helper
  format.js                helper format (client + server)
```
