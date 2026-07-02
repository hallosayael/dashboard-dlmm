// Sumber data: portfolio + per-position API Meteora (sama seperti bengbeng.fun).
//   1) GET /portfolio?user=&days_back=365      -> daftar pool wallet (+ nama pair)
//   2) GET /positions/{pool}/pnl?user=&status=closed
//                                              -> posisi closed individual per pool
//
// Data per-posisi: createdAt, closedAt, pnlSol, allTimeFees/Deposits (dalam SOL).
// Dengan per-posisi, kalender realized-PnL jatuh di tanggal close yang benar.

import { fetchWithTimeout, mapLimit } from './http';

const DATAPI = 'https://dlmm.datapi.meteora.ag';
const UA = 'Mozilla/5.0 (compatible; dlmm-dashboard)';
const DAYS_BACK = 365;
const MAX_LIST_PAGES = 25;  // daftar pool: 25 x 100
const MAX_POOLS = 400;      // batas pool yang diambil detail posisinya
const MAX_POS_PAGES = 6;    // posisi per pool: 6 x 100
const CONCURRENCY = 15;

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function getJson(url) {
  const r = await fetchWithTimeout(url, { headers: { 'User-Agent': UA } }, 9000);
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    const err = new Error('Meteora ' + r.status + (t ? ': ' + t.slice(0, 140) : ''));
    err.status = r.status;
    throw err;
  }
  return r.json();
}

// 1) Daftar pool yang pernah dipakai wallet (+ nama pair).
async function getPoolList(wallet) {
  const pools = [];
  let page = 1;
  for (let i = 0; i < MAX_LIST_PAGES; i++) {
    const u = new URL(`${DATAPI}/portfolio`);
    u.searchParams.set('user', wallet);
    u.searchParams.set('page', String(page));
    u.searchParams.set('page_size', '100');
    u.searchParams.set('days_back', String(DAYS_BACK));
    let j;
    try {
      j = await getJson(u.toString());
    } catch (e) {
      if (i === 0) throw e;
      break;
    }
    for (const p of j?.pools || []) {
      pools.push({
        poolAddress: p.poolAddress,
        pair: `${p.tokenX || '?'}/${p.tokenY || '?'}`,
        binStep: p.binStep,
        baseFee: p.baseFee,
      });
    }
    if (!j?.hasNext) break;
    page++;
  }
  return pools;
}

function mapPosition(pos, pool) {
  const createdAt = num(pos.createdAt);
  const closedAt = num(pos.closedAt);
  const lo = Number(pos.lowerBinId);
  const hi = Number(pos.upperBinId);
  return {
    pair: pool.pair,
    poolAddress: pool.poolAddress,
    positionAddress: pos.positionAddress || '',
    createdAt,
    closedAt,
    ageDays: closedAt > createdAt ? (closedAt - createdAt) / 86400 : null,
    pnlSol: num(pos.pnlSol),
    pnlPct: num(pos.pnlSolPctChange),
    feesSol: num(pos.allTimeFees?.total?.sol),
    depositSol: num(pos.allTimeDeposits?.total?.sol),
    withdrawSol: num(pos.allTimeWithdrawals?.total?.sol),
    minPrice: num(pos.minPrice),
    maxPrice: num(pos.maxPrice),
    activePrice: num(pos.poolActivePrice),
    bins: Number.isFinite(lo) && Number.isFinite(hi) ? hi - lo + 1 : null,
    binStep: pool.binStep,
    baseFee: pool.baseFee,
  };
}

// 2) Posisi closed individual untuk satu pool.
async function getPoolPositions(wallet, pool) {
  const out = [];
  let page = 1;
  for (let i = 0; i < MAX_POS_PAGES; i++) {
    const u = new URL(`${DATAPI}/positions/${pool.poolAddress}/pnl`);
    u.searchParams.set('user', wallet);
    u.searchParams.set('status', 'closed');
    u.searchParams.set('page', String(page));
    u.searchParams.set('page_size', '100');
    let j;
    try {
      j = await getJson(u.toString());
    } catch (_) {
      break;
    }
    for (const pos of j?.positions || []) out.push(mapPosition(pos, pool));
    if (!j?.hasNext) break;
    page++;
  }
  return out;
}

export async function getClosedPositions(wallet) {
  const pools = (await getPoolList(wallet)).slice(0, MAX_POOLS);
  const lists = await mapLimit(pools, CONCURRENCY, (p) => getPoolPositions(wallet, p));
  const positions = lists.flat();
  positions.sort((a, b) => b.closedAt - a.closedAt);
  return positions;
}
