// Resolusi metadata pool DLMM lewat datapi Meteora (publik, terverifikasi).
//   GET https://dlmm.datapi.meteora.ag/pools/{address}
// Dipakai untuk: (1) cek apakah sebuah akun adalah pool DLMM, (2) nama pair,
// (3) harga USD tiap token (untuk konversi ke SOL).

import { fetchWithTimeout } from './http';

const DATAPI = 'https://dlmm.datapi.meteora.ag';
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const cache = new Map(); // address -> pool | null

export async function getPool(address) {
  if (!address || !BASE58.test(address)) return null;
  if (cache.has(address)) return cache.get(address);

  let result = null;
  try {
    const r = await fetchWithTimeout(`${DATAPI}/pools/${address}`, {}, 5000);
    if (r.ok) {
      const j = await r.json();
      if (j && j.address) {
        result = {
          address: j.address,
          name: (j.name || '').replace(/-/g, '/'),
          x: tok(j.token_x),
          y: tok(j.token_y),
        };
      }
    }
  } catch (_) {}

  cache.set(address, result);
  return result;
}

function tok(t) {
  return {
    mint: t?.address || '',
    sym: t?.symbol || '',
    dec: Number(t?.decimals) || 0,
    priceUsd: Number(t?.price) || 0,
  };
}
