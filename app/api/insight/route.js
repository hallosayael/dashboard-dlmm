import { NextResponse } from 'next/server';
import { fetchWithTimeout } from '../../../lib/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

// Model bisa diganti lewat env. Default = paling hemat/cepat.
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const r2 = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 10000) / 10000 : 0);
const pct = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 100) : 0);

function buildPrompt(m) {
  const metrics = {
    rentang: m.range,
    jumlah_posisi_closed: m.n,
    net_pnl_sol: r2(m.totalPnl),
    fee_didapat_sol: r2(m.totalFees),
    komponen_harga_IL_sol: r2(m.priceIl),
    total_deposit_sol: r2(m.totalDeposit),
    roi_agregat_persen: pct(m.roiAgg),
    winrate_persen: pct(m.winRate),
    IL_memakan_persen_dari_fee: pct(m.ilRatio),
    rata_rata_hold_menit: m.avgHoldMin,
    max_drawdown_sol: r2(m.maxDD),
    drawdown_relatif_persen: pct(m.relDD),
    skor_kesehatan: m.overall,
    status_kesehatan: m.status,
    pool_terbaik: m.bestPool ? { pair: m.bestPool.pair, pnl_sol: r2(m.bestPool.pnl), trade: m.bestPool.trades } : null,
    pool_terburuk: m.worstPool ? { pair: m.worstPool.pair, pnl_sol: r2(m.worstPool.pnl), trade: m.worstPool.trades } : null,
    posisi_hold_pendek_kurang_2jam: m.shortCount,
    posisi_hold_panjang_lebih_2jam: m.longCount,
    hold_panjang_lebih_buruk: !!m.longWorse,
  };

  return [
    'Kamu analis LP (liquidity provider) Meteora DLMM di Solana.',
    '',
    'KONTEKS DLMM: LP menaruh likuiditas pada rentang bin harga. LP mendapat FEE dari swap,',
    'tetapi rugi akibat pergerakan harga (impermanent loss / IL). Net = fee - IL.',
    'Kalau harga keluar dari rentang bin, posisi berhenti menghasilkan fee.',
    '',
    'ATURAN KERAS (WAJIB):',
    '- Gunakan HANYA angka pada METRIK di bawah. DILARANG menghitung, menjumlah, atau mengarang angka baru.',
    '- Jangan menyebut angka apa pun yang tidak ada di METRIK.',
    '- Jangan memberi nasihat finansial atau menjanjikan hasil.',
    '- Bahasa Indonesia, ringkas, langsung ke inti, tanpa basa-basi.',
    '',
    'METRIK (sudah final, hasil perhitungan deterministik):',
    JSON.stringify(metrics, null, 2),
    '',
    'Tugas:',
    '1. "analisa": 2-4 kalimat menjelaskan kondisi wallet — fokus pada fee vs IL, winrate,',
    '   durasi hold, dan pool terbaik/terburuk.',
    '2. "saran": SATU kalimat saran konkret & bisa langsung dilakukan.',
    '',
    'Balas HANYA JSON valid: {"analisa":"...","saran":"..."}',
  ].join('\n');
}

export async function POST(request) {
  const key = process.env.GEMINI_API_KEY;
  // Tanpa key -> beri tahu client supaya fallback ke teks rule-based (bukan error keras).
  if (!key) return NextResponse.json({ error: 'LLM_OFF' });

  let m;
  try {
    m = await request.json();
  } catch {
    return NextResponse.json({ error: 'body tidak valid' }, { status: 400 });
  }
  if (!m || !m.n) return NextResponse.json({ error: 'metrik kosong' });

  try {
    const r = await fetchWithTimeout(
      `${BASE}/${MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(m) }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 400,
            responseMimeType: 'application/json',
          },
        }),
      },
      20000
    );

    if (!r.ok) {
      const t = await r.text().catch(() => '');
      return NextResponse.json({ error: `gemini ${r.status}`, detail: t.slice(0, 180) });
    }

    const j = await r.json();
    const text = j?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    let out;
    try { out = JSON.parse(text); } catch { out = { analisa: String(text).trim(), saran: '' }; }
    if (!out?.analisa) return NextResponse.json({ error: 'balasan kosong' });

    return NextResponse.json({
      analisa: String(out.analisa),
      saran: String(out.saran || ''),
      model: MODEL,
    });
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'gagal memanggil LLM' });
  }
}
