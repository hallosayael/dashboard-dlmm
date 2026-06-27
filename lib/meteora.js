// Orchestrator data layer (server-side).
//  - wallet kosong / "demo"  -> data contoh
//  - wallet asli             -> endpoint portfolio Meteora (tanpa API key)

import { getClosedPositions } from './portfolio';
import { getSolUsd, getUsdIdr } from './prices';

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const FALLBACK_SOL_PRICE = 150;

export async function getWalletData(walletInput) {
  const wallet = (walletInput || '').trim();

  if (!wallet || wallet.toLowerCase() === 'demo') {
    return buildDemo();
  }
  if (!BASE58.test(wallet)) {
    throw new Error('Alamat wallet Solana tidak valid');
  }

  const [positions, solPrice, usdIdr] = await Promise.all([
    getClosedPositions(wallet),
    getSolUsd(),
    getUsdIdr(),
  ]);
  return { wallet, solPrice, usdIdr, demo: false, positions };
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
  return { wallet: 'demo', solPrice: FALLBACK_SOL_PRICE, usdIdr: 16500, demo: true, positions };
}
