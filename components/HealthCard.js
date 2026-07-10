'use client';

// Kartu share untuk PNG. Bukan tampilan popup — lebar tetap 1100px supaya hasil
// export identik di desktop maupun HP. Dirender di luar layar (lihat .hc di globals.css).
//
// Aturan privasi: TIDAK ADA nominal SOL di kartu ini. Hanya skor, huruf, rasio,
// dan warna. Angka absolut tetap tinggal di dashboard.

const BULAN = ['jan', 'feb', 'mar', 'apr', 'mei', 'jun', 'jul', 'agu', 'sep', 'okt', 'nov', 'des'];

const ASCII = [
  '█▀▄ █   █▄ ▄█ █▄ ▄█',
  '█ █ █   █ ▀ █ █ ▀ █',
  '█▄▀ █▄▄ █   █ █   █',
];

function bar(score) {
  const f = Math.max(0, Math.min(10, Math.round((Number(score) || 0) / 10)));
  return '▰'.repeat(f) + '▱'.repeat(10 - f);
}

const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

// 6 hari terakhir (termasuk hari ini) -> profit / loss / kosong
function last6Days(positions) {
  const sum = {};
  for (const p of positions) {
    const d = new Date(p.closedAt * 1000);
    const k = dayKey(d);
    sum[k] = (sum[k] || 0) + (Number(p.pnlSol) || 0);
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const v = sum[dayKey(d)];
    out.push(v === undefined || v === 0 ? 'n' : v > 0 ? 'p' : 'l');
  }
  return out;
}

export default function HealthCard({ innerRef, health, positions, range, walletLabel }) {
  if (!health) return null;

  const h = health;
  const wins = positions.filter((p) => p.pnlSol > 0).length;
  const losses = h.n - wins;

  // fee coverage = fee ÷ kerugian harga. Breakeven di 1.00x.
  // Kalau harga justru menguntungkan, tidak ada yang perlu "ditutup" -> n/a.
  const ilLoss = Math.max(0, -h.priceIl);
  const coverage = ilLoss > 0 ? h.totalFees / ilLoss : null;
  const covClass = coverage === null ? 'dimc' : coverage >= 1 ? 'gr' : coverage >= 0.7 ? 'am' : 'rd';

  const now = new Date();
  const tanggal = `${now.getDate()} ${BULAN[now.getMonth()]} ${now.getFullYear()}`;

  return (
    <div className="hc" ref={innerRef}>
      <div className="hc-prompt">
        meridian@dlmm:~$ <span className="hc-cmd">dlmm-fetch --health</span>
      </div>

      <div className="hc-body">
        <div className="hc-left">
          <pre className="hc-ascii">{ASCII.join('\n')}</pre>
          <pre className="hc-bins">
            <span className="hc-off">▂ ▄ </span>
            <span className="hc-on">▆ █ █ █ █ ▆</span>
            <span className="hc-off"> ▄ ▂</span>
            {'\n'}
            <span className="hc-rule">───────────────────</span>
          </pre>

          <div className="hc-score">
            <span className={'hc-num ' + h.status.c}>{h.overall}</span>
            <span className="hc-den">/100</span>
          </div>
          <div>
            <span className={'hc-badge ' + h.status.c}>{h.status.t}</span>
          </div>
        </div>

        <div className="hc-right">
          <div className="hc-addr">{walletLabel}</div>
          <div className="hc-hr" />

          <div className="hc-kv"><span className="hc-k">range</span>{range} · {h.n} closed</div>
          <div className="hc-kv">
            <span className="hc-k">win rate</span>{Math.round(h.winRate * 100)}%
            <span className="dimc"> ({wins}W / {losses}L)</span>
          </div>
          <div className="hc-kv">
            <span className="hc-k">coverage</span>
            <span className={covClass}>{coverage === null ? '—' : coverage.toFixed(2) + '×'}</span>
            <span className="dimc"> (bep 1.00×)</span>
          </div>

          <div className="hc-dash" />

          {h.grades.map((g) => (
            <div className="hc-kv" key={g.k}>
              <span className="hc-k">{g.k}</span>
              <span className={g.c}>{bar(g.s)} {g.g}</span>
            </div>
          ))}

          <div className="hc-dash" />

          {h.insights.map((t, i) => <div className="hc-ins" key={i}>! {t}</div>)}

          <div className="hc-blocks">
            {last6Days(positions).map((s, i) => <span className={'hc-blk ' + s} key={i} />)}
            <span className="hc-blk-lbl">pnl 6d</span>
          </div>
        </div>
      </div>

      <div className="hc-note"># skor heuristik internal, bukan standar industri</div>
      <div className="hc-dash" />
      <div className="hc-foot">
        <span className="hc-site">dashboard.dlmm.my.id</span>
        <span className="dimc">{tanggal}</span>
      </div>
    </div>
  );
}
