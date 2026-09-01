import { NextResponse } from 'next/server';
import { getWalletData } from '../../../lib/meteora';
import { computeHealth } from '../../../lib/analytics';
import { fmtMoney, tzYMD, pnlState } from '../../../lib/format';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const TZ = 7; // GMT+7
const RANGE_DAYS = { '7d': 7, '30d': 30, all: Infinity };

// Cache in-memory per wallet supaya polling widget (KWGT refresh tiap ~30 mnt,
// tapi bisa beberapa field sekaligus) tidak menghajar API Meteora tiap request.
const CACHE = new Map(); // key -> { t, data }
const TTL = 5 * 60 * 1000;

async function getCached(wallet) {
  const key = wallet.trim().toLowerCase();
  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.t < TTL) return hit.data;
  const data = await getWalletData(wallet);
  CACHE.set(key, { t: Date.now(), data });
  return data;
}

function compute(data, denom, range) {
  const positions = data.positions || [];
  const solPrice = data.solPrice;
  const usdIdr = data.usdIdr;
  const m = (sol, o) => fmtMoney(sol, denom, solPrice, usdIdr, { compact: true, ...o });

  const cutoff = range === 'all' ? -Infinity : Date.now() / 1000 - RANGE_DAYS[range] * 86400;
  const ranged = positions.filter((p) => p.closedAt >= cutoff);

  const today = tzYMD(Date.now() / 1000, TZ);
  const todaySol = positions
    .filter((p) => { const d = tzYMD(p.closedAt, TZ); return d.y === today.y && d.m === today.m && d.d === today.d; })
    .reduce((a, p) => a + p.pnlSol, 0);

  const netSol = ranged.reduce((a, p) => a + p.pnlSol, 0);
  const feesSol = ranged.reduce((a, p) => a + p.feesSol, 0);
  const wins = ranged.filter((p) => pnlState(p.pnlSol) > 0).length;
  const losses = ranged.filter((p) => pnlState(p.pnlSol) < 0).length;
  const winRate = (wins + losses) ? Math.round((wins / (wins + losses)) * 100) : 0;

  // sparkline: net pnl harian 14 hari terakhir (SOL), urut lama -> baru
  const DAYS = 14;
  const nowDay = Math.floor((Date.now() / 1000 + TZ * 3600) / 86400);
  const spark = new Array(DAYS).fill(0);
  for (const p of positions) {
    const idx = nowDay - Math.floor((p.closedAt + TZ * 3600) / 86400);
    if (idx >= 0 && idx < DAYS) spark[DAYS - 1 - idx] += p.pnlSol;
  }

  // heatmap: net pnl harian 30 hari terakhir (SOL), urut lama -> baru — utk layout ticker/statusline
  const D30 = 30;
  const days30 = new Array(D30).fill(0);
  for (const p of positions) {
    const idx = nowDay - Math.floor((p.closedAt + TZ * 3600) / 86400);
    if (idx >= 0 && idx < D30) days30[D30 - 1 - idx] += p.pnlSol;
  }

  // grid BULAN KALENDER berjalan (GMT+7) — utk widget "kalender per bulan" (ala web).
  // monthDays[i] = net pnl hari (i+1); monthFirst = weekday tgl 1 (0=Min..6=Sab).
  const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const daysInMonth = new Date(Date.UTC(today.y, today.m + 1, 0)).getUTCDate();
  const monthFirst = new Date(Date.UTC(today.y, today.m, 1)).getUTCDay();
  const monthDays = new Array(daysInMonth).fill(0);
  for (const p of positions) {
    const d = tzYMD(p.closedAt, TZ);
    if (d.y === today.y && d.m === today.m) monthDays[d.d - 1] += p.pnlSol;
  }
  const monthLabel = MON[today.m] + ' ' + today.y;

  // skor wallet-health (heuristik internal, sama dgn dashboard) — utk layout statusline/glance
  const h = computeHealth(ranged);

  const walletShort = (data.wallets && data.wallets[0]) || 'wallet';
  const label = data.demo ? 'demo' : (data.wallets && data.wallets.length > 1 ? data.wallets.length + ' wallets' : walletShort.slice(0, 4) + '…' + walletShort.slice(-4));

  return {
    // angka mentah (SOL)
    netSol, todaySol, feesSol, winRate, wins, losses, closed: ranged.length,
    // string siap-tampil sesuai denom (dgn unit)
    net: m(netSol), today: m(todaySol), fees: m(feesSol),
    // versi tanpa unit — utk layout compact (ticker/statusline/glance) yg ruangnya sempit
    netBare: m(netSol, { bare: true }), feesBare: m(feesSol, { bare: true }), todayBare: m(todaySol, { bare: true }),
    winrate: winRate + '%', count: String(ranged.length),
    updated: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }),
    label, denom, range,
    line: `net ${m(netSol)} · today ${m(todaySol)} · ${winRate}%`,
    spark: spark.map((v) => Math.round(v * 1e6) / 1e6),
    days30: days30.map((v) => Math.round(v * 1e6) / 1e6),
    monthDays: monthDays.map((v) => Math.round(v * 1e6) / 1e6),
    monthFirst, monthLabel,
    health: h ? h.overall : null,
    healthStatus: h ? h.status.t : '—',
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get('wallet') || '';
  const denom = (searchParams.get('denom') || 'sol').toLowerCase();
  const range = RANGE_DAYS[searchParams.get('range')] ? searchParams.get('range') : '30d';
  const field = searchParams.get('field');
  const format = searchParams.get('format') || (field ? 'text' : 'json');

  if (!wallet) {
    return NextResponse.json({ error: 'param wallet wajib' }, { status: 400 });
  }

  try {
    const data = await getCached(wallet);
    const r = compute(data, ['sol', 'usd', 'idr'].includes(denom) ? denom : 'sol', range);

    if (format === 'text') {
      const val = field && r[field] != null ? String(r[field]) : r.line;
      return new Response(val, {
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=120' },
      });
    }
    return NextResponse.json(r, { headers: { 'cache-control': 'public, max-age=120' } });
  } catch (e) {
    if (format === 'text') return new Response('—', { status: 200, headers: { 'content-type': 'text/plain' } });
    return NextResponse.json({ error: e?.message || 'gagal' }, { status: 400 });
  }
}
