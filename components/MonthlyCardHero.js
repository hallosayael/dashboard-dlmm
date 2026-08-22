'use client';

// Isi kartu PnL bulanan — versi "hero recap": pixel $ raksasa yang membelah keluar
// dari tepi kanan, tema terminal gelap. Otomatis merah + label "loss" saat bulan
// minus (fees & biggest win tetap hijau — fee tetap didapat, posisi terbaik tetap ada
// walau bulannya rugi). Rasio ~72:47 mengikuti sample yang dipakai sebagai acuan.
// Komponen ini HANYA badan kartu (tanpa modal/overlay/tombol) — dipakai di dalam
// MonthlyShareModal, yang mengurus swipe antar-gaya + tombol download/tutup.

import { fmtMoney, fmtRoi, pnlState, tzYMD, MONTH_NAMES } from '../lib/format';

export default function MonthlyCardHero({ cardRef, M, year, month, cur, solUsd, usdIdr, positions }) {
  const cval = (v, o) => fmtMoney(v, cur, solUsd, usdIdr, o);
  const compactBare = { compact: true, bare: true };
  const compactSym = cur === 'sol' ? compactBare : { compact: true };

  const monthPositions = (positions || []).filter((p) => {
    const t = tzYMD(p.closedAt, 7);
    return t.y === year && t.m === month;
  });

  let fees = 0;
  for (const d in M.days) fees += M.days[d].f;

  let best = null;
  for (const p of monthPositions) {
    if (!best || p.pnlSol > best.pnlSol) best = p;
  }

  const closedCount = monthPositions.length;
  const impasCount = monthPositions.filter((p) => pnlState(p.pnlSol) === 0).length;
  const winRate = M.green + M.red > 0 ? Math.round((M.green / (M.green + M.red)) * 100) : 0;
  const isLoss = M.total < 0;
  const iso = `${year}-${String(month + 1).padStart(2, '0')}`;

  const now = new Date();
  const stamp = `${now.getDate()} ${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;

  const stateCls = isLoss ? 'r' : 'g';
  const pillBg = isLoss ? '#f85149' : '#3fb950';
  const pillFg = isLoss ? '#2b0808' : '#04150b';
  const pixColor = isLoss ? '#f85149' : '#3fb950';
  const pixGhostColor = isLoss ? '#3a1414' : '#123420';

  return (
    <div className="mh-card" ref={cardRef}>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <g id="mh-pixd" fill="currentColor">
            <rect x="2" y="0" width=".84" height=".84" rx=".1" />
            <rect x="1" y="1" width=".84" height=".84" rx=".1" /><rect x="2" y="1" width=".84" height=".84" rx=".1" /><rect x="3" y="1" width=".84" height=".84" rx=".1" />
            <rect x="0" y="2" width=".84" height=".84" rx=".1" /><rect x="2" y="2" width=".84" height=".84" rx=".1" />
            <rect x="1" y="3" width=".84" height=".84" rx=".1" /><rect x="2" y="3" width=".84" height=".84" rx=".1" /><rect x="3" y="3" width=".84" height=".84" rx=".1" />
            <rect x="2" y="4" width=".84" height=".84" rx=".1" /><rect x="4" y="4" width=".84" height=".84" rx=".1" />
            <rect x="1" y="5" width=".84" height=".84" rx=".1" /><rect x="2" y="5" width=".84" height=".84" rx=".1" /><rect x="3" y="5" width=".84" height=".84" rx=".1" />
            <rect x="2" y="6" width=".84" height=".84" rx=".1" />
          </g>
        </defs>
      </svg>

      <svg viewBox="0 0 5 7" className="mh-pixghost" style={{ color: pixGhostColor }} aria-hidden="true"><use href="#mh-pixd" /></svg>

      <div className="mh-top">
        <span><span className="mh-g">meridian@dlmm</span><span className="mh-dim2">:~$</span> <span className="mh-cmd">dlmm-recap {iso}</span></span>
        <span className="mh-dim">{stamp}</span>
      </div>

      <div className="mh-mid">
        <div className="mh-left">
          <div className={'mh-plabel mh-' + stateCls}>{isLoss ? 'loss' : 'profit'} &middot; {MONTH_NAMES[month]} {year}</div>
          <span className="mh-pill" style={{ background: pillBg, color: pillFg }}>{cval(M.total, compactSym)}</span>
          <div className="mh-kv"><span className="mh-dim">realized</span> <b className={'mh-' + stateCls}>{cval(M.total, compactSym)}</b></div>
          <div className="mh-kv"><span className="mh-dim">fees earned</span> <b className="mh-g">{cval(fees, compactSym)}</b></div>
          <div className="mh-kv">
            <span className="mh-dim">biggest win</span>{' '}
            <b className="mh-g">{best ? `${best.pair} ${cval(best.pnlSol, { compact: true, unit: false })} (${fmtRoi(best.pnlSol, best.pnlPct)})` : '—'}</b>
          </div>
          <div className="mh-kv"><span className="mh-dim">win rate</span> <b className="mh-num">{winRate}%</b> <span className="mh-dim2">({M.green}W / {M.red}L)</span></div>
        </div>
        <svg viewBox="0 0 5 7" className="mh-pix" style={{ color: pixColor }} aria-hidden="true"><use href="#mh-pixd" /></svg>
      </div>

      <div className="mh-foot">
        <span className="mh-site">dashboard.dlmm.my.id</span>
        <span className="mh-dim2">{closedCount} closed &middot; {impasCount} impas</span>
      </div>
    </div>
  );
}
