import { NextResponse } from 'next/server';
import { fetchWithTimeout } from '../../../lib/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Google kadang mem-pensiunkan model untuk akun baru. Daripada menebak,
// kita coba beberapa kandidat berurutan sampai ada yang berhasil.
const FALLBACK_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
  'gemini-2.5-flash',
];

function modelCandidates() {
  const envM = (process.env.GEMINI_MODEL || '').trim();
  return [...new Set(envM ? [envM, ...FALLBACK_MODELS] : FALLBACK_MODELS)];
}

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
    pool_pnl_tertinggi: m.bestPool ? { pair: m.bestPool.pair, pnl_sol: r2(m.bestPool.pnl), trade: m.bestPool.trades } : null,
    pool_pnl_terendah: m.worstPool ? { pair: m.worstPool.pair, pnl_sol: r2(m.worstPool.pnl), trade: m.worstPool.trades } : null,
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
    '- "pool_pnl_tertinggi" HANYA berarti PnL paling tinggi, BUKAN otomatis untung.',
    '  Periksa "pnl_sol"-nya: kalau <= 0, sebut "paling sedikit rugi" / "kerugian terkecil".',
    '  DILARANG menyebutnya "kontributor positif", "menguntungkan", atau "terbaik" saat pnl_sol <= 0.',
    '- Begitu pula "pool_pnl_terendah" baru boleh disebut "rugi terbesar" jika pnl_sol < 0.',
    '- Jangan memberi nasihat finansial atau menjanjikan hasil.',
    '- Bahasa Indonesia, ringkas, langsung ke inti, tanpa basa-basi.',
    '',
    'METRIK (sudah final, hasil perhitungan deterministik):',
    JSON.stringify(metrics, null, 2),
    '',
    'Tugas:',
    '1. "analisa": 2-4 kalimat menjelaskan kondisi wallet — fokus pada fee vs IL, winrate,',
    '   durasi hold, dan pool dengan PnL tertinggi/terendah.',
    '2. "saran": SATU kalimat saran konkret & bisa langsung dilakukan.',
    '',
    'Balas HANYA JSON valid: {"analisa":"...","saran":"..."}',
  ].join('\n');
}

async function callModel(model, key, prompt) {
  return fetchWithTimeout(
    `${BASE}/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 400, responseMimeType: 'application/json' },
      }),
    },
    20000
  );
}

export async function POST(request) {
  const key = process.env.GEMINI_API_KEY;
  // Tanpa key -> client fallback ke teks rule-based (bukan error keras).
  if (!key) return NextResponse.json({ error: 'LLM_OFF' });

  let m;
  try {
    m = await request.json();
  } catch {
    return NextResponse.json({ error: 'body tidak valid' }, { status: 400 });
  }
  if (!m || !m.n) return NextResponse.json({ error: 'metrik kosong' });

  const prompt = buildPrompt(m);
  let lastError = '';
  let lastDetail = '';

  for (const model of modelCandidates()) {
    let r;
    try {
      r = await callModel(model, key, prompt);
    } catch (e) {
      lastError = `network (${model})`;
      lastDetail = e?.message || '';
      continue; // timeout/jaringan -> coba model berikutnya
    }

    if (r.ok) {
      const j = await r.json();
      const text = j?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      let out;
      try { out = JSON.parse(text); } catch { out = { analisa: String(text).trim(), saran: '' }; }
      if (!out?.analisa) { lastError = `balasan kosong (${model})`; continue; }
      return NextResponse.json({ analisa: String(out.analisa), saran: String(out.saran || ''), model });
    }

    const t = await r.text().catch(() => '');
    lastError = `gemini ${r.status} (${model})`;
    lastDetail = t.slice(0, 180);

    // 404/400 = model tidak tersedia untuk akun ini -> coba kandidat berikutnya.
    if (r.status === 404 || r.status === 400) continue;

    // 401/403 (key salah) atau 429 (kuota habis) -> ganti model tidak menolong.
    return NextResponse.json({ error: lastError, detail: lastDetail });
  }

  return NextResponse.json({ error: lastError || 'semua model gagal', detail: lastDetail });
}
