// Perhitungan untuk fitur "analyze" (wallet-health, pool-analysis, audit,
// compare, insight). Semua fungsi murni (tanpa side-effect) & jalan di client.
//
// Semua nilai uang disimpan dalam SOL — komponen yang memformat ke USD/IDR.
//
// CATATAN JUJUR: sub-skor di bawah adalah HEURISTIK, bukan metrik standar
// industri. Konstanta (25, 8, dsb) di-tune tangan. Angka mentahnya nyata
// (dari API Meteora), tapi skor & huruf bersifat opini.

const S = (arr, f) => arr.reduce((s, p) => s + (Number(p[f]) || 0), 0);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
function stdev(a) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(mean(a.map((x) => (x - m) ** 2)));
}

// skor 0–100 -> huruf
export function grade(score) {
  if (score >= 93) return 'A';
  if (score >= 85) return 'A-';
  if (score >= 80) return 'B+';
  if (score >= 73) return 'B';
  if (score >= 66) return 'B-';
  if (score >= 60) return 'C+';
  if (score >= 53) return 'C';
  if (score >= 45) return 'C-';
  if (score >= 35) return 'D';
  return 'F';
}
export function gradeColor(score) {
  return score >= 73 ? 'gr' : score >= 53 ? 'am' : 'rd';
}

// Max drawdown (peak-to-trough) dari equity curve realized, dalam SOL.
// relDD dinormalisasi ke [0,1] sehingga TIDAK MUNGKIN > 100%.
// (Rumus lama memakai penyebut max(peak,|total|,0.05) → bisa menghasilkan 109%.)
function drawdown(positions) {
  const sorted = [...positions].sort((a, b) => a.closedAt - b.closedAt);
  let cum = 0, peak = 0, maxDD = 0;
  for (const p of sorted) {
    cum += Number(p.pnlSol) || 0;
    if (cum > peak) peak = cum;
    const dd = peak - cum;
    if (dd > maxDD) maxDD = dd;
  }
  // seberapa dalam turunnya dibanding (puncak + turunnya itu sendiri)
  const relDD = peak + maxDD > 0 ? maxDD / (peak + maxDD) : 0;
  return { maxDD, peak, relDD, total: cum };
}

// ── wallet health ────────────────────────────────────────────────────────
export function computeHealth(positions) {
  const n = positions.length;
  if (!n) return null;

  const wins = positions.filter((p) => p.pnlSol > 0).length;
  const winRate = wins / n;
  const totalPnl = S(positions, 'pnlSol');
  const totalFees = S(positions, 'feesSol');
  const totalDep = S(positions, 'depositSol');
  const priceIl = totalPnl - totalFees;            // komponen harga / IL
  const roiAgg = totalDep > 0 ? totalPnl / totalDep : 0;
  const ilLoss = Math.max(0, -priceIl);
  const ilRatio = totalFees > 0 ? ilLoss / totalFees : (ilLoss > 0 ? 1 : 0);

  const sd = stdev(positions.map((p) => Number(p.pnlPct) || 0));
  const { maxDD, peak, relDD } = drawdown(positions);

  // sub-skor — pakai tanh/exp agar tidak "mentok" mendadak di 0/100
  const profScore = clamp(50 + 50 * Math.tanh(roiAgg * 25), 0, 100); // ROI agregat vs modal
  const consScore = clamp(winRate * 100, 0, 100);                     // winrate
  const effScore = clamp(100 * Math.exp(-ilRatio), 0, 100);           // fee terjaga dari IL
  const riskScore = clamp(100 * Math.exp(-sd / 8), 0, 100);           // volatilitas antar-posisi
  const ddScore = clamp(100 * (1 - relDD), 0, 100);                   // kedalaman drawdown

  const overall = Math.round(
    profScore * 0.30 + consScore * 0.20 + effScore * 0.20 + riskScore * 0.15 + ddScore * 0.15
  );
  const status = overall >= 80 ? { t: 'healthy', c: 'gr' }
    : overall >= 60 ? { t: 'fair', c: 'am' }
      : { t: 'at risk', c: 'rd' };

  const grades = [
    { k: 'profitability', s: profScore },
    { k: 'consistency', s: consScore },
    { k: 'efficiency', s: effScore },
    { k: 'risk', s: riskScore },
    { k: 'drawdown', s: ddScore },
  ].map((g) => ({ ...g, g: grade(g.s), c: gradeColor(g.s) }));

  // insight (rule-based) — ambang diperketat agar tidak ketrigger noise
  const insights = [];
  if (ilRatio >= 0.4) insights.push(`IL memakan ${Math.round(ilRatio * 100)}% dari fee`);

  const hp = positions.filter((p) => p.createdAt && p.closedAt && p.closedAt > p.createdAt);
  const short = hp.filter((p) => (p.closedAt - p.createdAt) < 7200);
  const long = hp.filter((p) => (p.closedAt - p.createdAt) >= 7200);
  if (long.length >= 5 && short.length >= 5) {
    const diff = mean(long.map((p) => p.pnlPct || 0)) - mean(short.map((p) => p.pnlPct || 0));
    if (diff < -1) insights.push('hold >2 jam kurang optimal'); // selisih >1 poin persen
  }

  if (winRate < 0.5) insights.push(`winrate ${Math.round(winRate * 100)}% — di bawah 50%`);
  if (peak <= 0) insights.push('equity belum pernah di atas nol');
  else if (relDD > 0.35) insights.push(`drawdown ${Math.round(relDD * 100)}% dari puncak`);
  if (!insights.length) insights.push('metrik dalam batas sehat');

  return {
    n, overall, status, grades, insights: insights.slice(0, 3),
    winRate, roiAgg, ilRatio, totalPnl, totalFees, totalDep, priceIl,
    maxDD, peak, relDD, sd,
  };
}

// ── pool analytics ───────────────────────────────────────────────────────
export function computePools(positions) {
  const map = new Map();
  for (const p of positions) {
    const k = p.pair || '?';
    let o = map.get(k);
    if (!o) { o = { pair: k, pnl: 0, fees: 0, trades: 0, wins: 0, icon: p.icon || '' }; map.set(k, o); }
    o.pnl += Number(p.pnlSol) || 0;
    o.fees += Number(p.feesSol) || 0;
    o.trades += 1;
    if (p.pnlSol > 0) o.wins += 1;
  }
  return [...map.values()]
    .map((o) => ({ ...o, winRate: o.trades ? o.wins / o.trades : 0 }))
    .sort((a, b) => b.pnl - a.pnl);
}

// ── wallet audit ─────────────────────────────────────────────────────────
export function computeAudit(positions) {
  const deposit = S(positions, 'depositSol');
  const withdraw = S(positions, 'withdrawSol');
  const fees = S(positions, 'feesSol');
  const totalPnl = S(positions, 'pnlSol');
  const priceImpact = totalPnl - fees;
  const growth = totalPnl;
  const pass = growth >= 0;
  return {
    n: positions.length, deposit, withdraw, fees, priceImpact, growth, pass,
    note: pass ? 'consistent — hasil net positif' : 'review — hasil net negatif',
  };
}

// ── compare wallets ──────────────────────────────────────────────────────
export function computeCompare(positions, wallets) {
  const list = (wallets && wallets.length)
    ? wallets
    : [...new Set(positions.map((p) => p.owner).filter(Boolean))];

  const map = new Map(list.map((w) => [w, { wallet: w, pnl: 0, n: 0, wins: 0 }]));
  for (const p of positions) {
    const o = map.get(p.owner);
    if (!o) continue;
    o.pnl += Number(p.pnlSol) || 0;
    o.n += 1;
    if (p.pnlSol > 0) o.wins += 1;
  }
  const rows = [...map.values()]
    .map((o) => ({ ...o, winRate: o.n ? o.wins / o.n : 0 }))
    .sort((a, b) => b.pnl - a.pnl);
  const combined = rows.reduce((a, r) => a + r.pnl, 0);
  const totalN = rows.reduce((a, r) => a + r.n, 0);
  const totalW = rows.reduce((a, r) => a + r.wins, 0);

  const curves = list.map((w) => {
    const ps = positions.filter((p) => p.owner === w).sort((a, b) => a.closedAt - b.closedAt);
    let cum = 0;
    const pts = [{ t: ps.length ? ps[0].closedAt - 1 : 0, v: 0 }];
    for (const p of ps) { cum += Number(p.pnlSol) || 0; pts.push({ t: p.closedAt, v: cum }); }
    return { wallet: w, pts, pnl: cum };
  });

  return { rows, combined, winRate: totalN ? totalW / totalN : 0, curves, single: list.length < 2 };
}

// ── insight (rule-based; dipakai juga sebagai input untuk LLM) ────────────
export function computeInsight(positions) {
  const n = positions.length;
  if (!n) return null;
  const pools = computePools(positions);
  const health = computeHealth(positions);
  const totalFees = S(positions, 'feesSol');
  const hp = positions.filter((p) => p.createdAt && p.closedAt && p.closedAt > p.createdAt);
  const avgHoldMin = hp.length ? Math.round(mean(hp.map((p) => (p.closedAt - p.createdAt) / 60))) : 0;
  const short = hp.filter((p) => (p.closedAt - p.createdAt) < 7200);
  const long = hp.filter((p) => (p.closedAt - p.createdAt) >= 7200);
  const longWorse = long.length >= 5 && short.length >= 5
    && (mean(long.map((p) => p.pnlPct || 0)) - mean(short.map((p) => p.pnlPct || 0))) < -1;

  let suggestion;
  if (health.ilRatio >= 0.6) suggestion = 'kurangi durasi hold biar fee tidak habis tergerus IL';
  else if (longWorse) suggestion = 'fokus pada hold <1 jam — performa lebih baik';
  else if (health.winRate < 0.5) suggestion = 'perketat pemilihan pool — winrate masih di bawah 50%';
  else suggestion = 'pola sudah sehat — pertahankan ukuran & durasi posisi';

  return {
    n, totalFees, ilRatio: health.ilRatio, bestPool: pools[0] || null,
    worstPool: pools.length > 1 ? pools[pools.length - 1] : null,
    avgHoldMin, longWorse, winRate: health.winRate, suggestion,
    // ekstra untuk prompt LLM (angka deterministik, jangan biarkan LLM menghitung sendiri)
    totalPnl: health.totalPnl, totalDeposit: health.totalDep, priceIl: health.priceIl,
    roiAgg: health.roiAgg, maxDD: health.maxDD, relDD: health.relDD,
    overall: health.overall, status: health.status.t,
    shortCount: short.length, longCount: long.length,
  };
}
