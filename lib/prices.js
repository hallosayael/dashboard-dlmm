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
