import { NextResponse } from 'next/server';
import { fetchWithTimeout } from '../../../lib/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DATAPI = 'https://dlmm.datapi.meteora.ag';
const UA = 'Mozilla/5.0 (compatible; dlmm-dashboard)';
const TF_SEC = { '30m': 1800, '1h': 3600, '4h': 14400, '12h': 43200, '24h': 86400 };

// pilih timeframe candle sesuai lama posisi (candle terhalus = 30m)
function pickTimeframe(span) {
  const h = span / 3600;
  if (h <= 6) return '30m';
  if (h <= 24) return '1h';
  if (h <= 24 * 5) return '4h';
  if (h <= 24 * 14) return '12h';
  return '24h';
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const pool = (searchParams.get('pool') || '').trim();
  const from = Number(searchParams.get('from')) || 0;
  const to = Number(searchParams.get('to')) || Math.floor(Date.now() / 1000);
  if (!pool) return NextResponse.json({ error: 'pool wajib' }, { status: 400 });

  const span = Math.max(1, to - from);
  const tf = pickTimeframe(span);
  const pad = Math.max(TF_SEC[tf] * 3, Math.round(span * 0.25));

  try {
    const u = new URL(`${DATAPI}/pools/${pool}/ohlcv`);
    u.searchParams.set('timeframe', tf);
    u.searchParams.set('start_time', String(Math.floor(from - pad)));
    u.searchParams.set('end_time', String(Math.ceil(to + pad)));
    const r = await fetchWithTimeout(u.toString(), { headers: { 'User-Agent': UA } }, 9000);
    if (!r.ok) throw new Error('OHLCV ' + r.status);
    const j = await r.json();
    const candles = (j?.data || [])
      .map((d) => ({ t: Number(d.timestamp), o: Number(d.open), h: Number(d.high), l: Number(d.low), c: Number(d.close) }))
      .filter((d) => Number.isFinite(d.t) && Number.isFinite(d.c));
    return NextResponse.json({ timeframe: j?.timeframe || tf, candles });
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'gagal ambil ohlcv' }, { status: 400 });
  }
}
