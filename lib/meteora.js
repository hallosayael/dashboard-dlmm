// Orchestrator data layer (server-side).
//  - wallet kosong / "demo"  -> data contoh
//  - wallet asli             -> endpoint portfolio Meteora (tanpa API key)

import { getClosedPositions } from './portfolio';
import { getSolUsd, getUsdIdr } from './prices';

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const FALLBACK_SOL_PRICE = 150;
const MAX_WALLETS = 5;

// Pisah input jadi daftar alamat unik (dipisah koma / spasi / baris baru).
export function parseWallets(input) {
  return [...new Set((input || '').split(/[\s,]+/).map((w) => w.trim()).filter(Boolean))];
}

export async function getWalletData(walletInput) {
  const raw = (walletInput || '').trim();

  if (!raw || raw.toLowerCase() === 'demo') {
    return buildDemo();
  }

  const list = parseWallets(raw).slice(0, MAX_WALLETS + 1); // +1 supaya kelebihan bisa terdeteksi
  if (list.length === 0) {
    throw new Error('Alamat wallet Solana tidak valid');
  }
  if (list.length > MAX_WALLETS) {
    throw new Error(`Maksimal ${MAX_WALLETS} wallet sekaligus`);
  }
  const invalid = list.filter((w) => !BASE58.test(w));
  if (invalid.length) {
    throw new Error('Alamat tidak valid: ' + invalid.map((w) => w.slice(0, 6) + '…').join(', '));
  }

  const [solPrice, usdIdr] = await Promise.all([getSolUsd(), getUsdIdr()]);

  // Fetch tiap wallet paralel; kegagalan satu wallet tidak menggagalkan yang lain.
  const results = await Promise.all(list.map(async (w) => {
    try {
      const positions = await getClosedPositions(w);
      for (const p of positions) p.owner = w;
      return { wallet: w, ok: true, positions };
    } catch (e) {
      return { wallet: w, ok: false, error: e?.message || 'gagal', positions: [] };
    }
  }));

  const ok = results.filter((r) => r.ok);
  if (ok.length === 0) {
    throw new Error(results[0]?.error || 'Gagal mengambil data');
  }

  const positions = ok.flatMap((r) => r.positions);
  positions.sort((a, b) => b.closedAt - a.closedAt);

  return {
    wallets: ok.map((r) => r.wallet),
    failed: results.filter((r) => !r.ok).map((r) => ({ wallet: r.wallet, error: r.error })),
    solPrice,
    usdIdr,
    demo: false,
    positions,
  };
}

// ---------------------------------------------------------------------------
// Demo data (wallet kosong / "demo") supaya situs langsung hidup.
// ---------------------------------------------------------------------------
const DEMO_DAYS = {
  1: 0.01, 2: 0.005, 3: 0.014, 4: -0.035, 5: 0.01, 6: -0.008,
  8: 0.001, 9: 0.011, 10: 0.003, 11: 0.001, 12: 0.001,
  14: 0.001, 15: 0.002, 16: 0.002, 17: 0.007, 18: -0.004, 19: 0.002, 20: 0.008,
  21: 0.008, 22: 0.002, 23: 0.002, 24: 0.003,
};
const DEMO_PAIRS = ['WIF/USDC', 'SOL/USDC', 'BONK/SOL', 'JUP/SOL', 'JTO/SOL', 'RAY/USDC', 'POPCAT/SOL', 'WEN/SOL'];

function buildDemo() {
  const positions = Object.entries(DEMO_DAYS).map(([d, pnl], i) => {
    const day = Number(d);
    const closedAt = Date.UTC(2026, 5, day, 5, 0, 0) / 1000; // 12:00 GMT+7
    const dep = 12 + (i % 6) * 8;
    const fee = Math.round((Math.abs(pnl) * 0.5 + 0.001) * 1000) / 1000;
    return {
      pair: DEMO_PAIRS[i % DEMO_PAIRS.length],
      poolAddress: 'DemoPool' + day,
      positionAddress: '',
      createdAt: 0,
      closedAt,
      ageDays: 3 + (i % 12),
      pnlSol: pnl,
      pnlPct: Math.round(pnl * 1000),
      feesSol: fee,
      depositSol: dep,
    };
  });
  positions.sort((a, b) => b.closedAt - a.closedAt);
  return { wallets: ['demo'], failed: [], solPrice: FALLBACK_SOL_PRICE, usdIdr: 16500, demo: true, positions };
}
