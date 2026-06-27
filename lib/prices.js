// Harga SOL (USD) via Jupiter price API (terverifikasi: lite-api.jup.ag/price/v3).

import { fetchWithTimeout } from './http';

export const WSOL = 'So11111111111111111111111111111111111111112';
const FALLBACK_SOL_USD = 150;

let cached = null;

export async function getSolUsd() {
  if (cached) return cached;
  try {
    const r = await fetchWithTimeout(`https://lite-api.jup.ag/price/v3?ids=${WSOL}`, {}, 5000);
    if (r.ok) {
      const j = await r.json();
      const p = Number(j?.[WSOL]?.usdPrice);
      if (p > 0) {
        cached = p;
        return p;
      }
    }
  } catch (_) {}
  return FALLBACK_SOL_USD;
}

const FALLBACK_USD_IDR = 16500;
let cachedIdr = null;

// Kurs USD -> IDR (untuk toggle mata uang IDR). Sumber: open.er-api.com (gratis).
export async function getUsdIdr() {
  if (cachedIdr) return cachedIdr;
  try {
    const r = await fetchWithTimeout('https://open.er-api.com/v6/latest/USD', {}, 5000);
    if (r.ok) {
      const j = await r.json();
      const v = Number(j?.rates?.IDR);
      if (v > 0) {
        cachedIdr = v;
        return v;
      }
    }
  } catch (_) {}
  return FALLBACK_USD_IDR;
}
