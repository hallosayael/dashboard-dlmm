'use client';

// Isi kartu PnL bulanan — versi kalender: grid per hari + kolom WEEK + ringkasan.
// Komponen ini HANYA badan kartu (tanpa modal/overlay/tombol) — dipakai di dalam
// MonthlyShareModal, yang mengurus swipe antar-gaya + tombol download/tutup.
// Lebar tetap 640px saat capture (diatur oleh MonthlyShareModal) supaya grid
// tidak reflow dan hasil PNG rapi di PC maupun HP.

import { fmtMoney, pnlState, pnlCls, MONTH_NAMES } from '../lib/format';

const WD = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function tierClass(v) {
  const st = pnlState(v);
  if (st === 0) return 'cb1';
  return st > 0 ? 'cg3' : 'cr3';     // 1 warna: plus = hijau terang, minus = merah terang
}

export default function MonthlyCard({ cardRef, M, year, month, cur, solUsd, usdIdr }) {
  const cval = (v, o) => fmtMoney(v, cur, solUsd, usdIdr, o);
  const compactBare = { compact: true, bare: true }; // sel grid: tanpa simbol (biar muat)
  // net + ringkasan: DENGAN simbol untuk USD/IDR ($/Rp). SOL tetap tanpa embel-embel
  // (judul sudah menulis "· SOL", dan angka SOL sudah jelas).
  const compactSym = cur === 'sol' ? compactBare : { compact: true };

  // tata letak grid — logika sama persis dengan Calendar.js
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  let maxAbs = 0;
  for (const d in M.days) maxAbs = Math.max(maxAbs, Math.abs(M.days[d].v));
  const numWeeks = Math.ceil((firstWeekday + daysInMonth) / 7);
  const weekTotals = new Array(numWeeks).fill(0);
  for (let day = 1; day <= daysInMonth; day++) {
    const c = M.days[day];
    if (!c) continue;
    weekTotals[Math.floor((firstWeekday + day - 1) / 7)] += c.v;
  }

  // ringkasan bulan
  let fees = 0, bestV = -Infinity, bestD = 0, worstV = Infinity, worstD = 0, pos = 0;
  for (const d in M.days) {
    const c = M.days[d];
    fees += c.f; pos += c.c;
    if (c.v > bestV) { bestV = c.v; bestD = Number(d); }
    if (c.v < worstV) { worstV = c.v; worstD = Number(d); }
  }
  const hasDays = Object.keys(M.days).length > 0;
  const winRate = M.green + M.red > 0 ? Math.round((M.green / (M.green + M.red)) * 100) : 0;
  const iso = `${year}-${String(month + 1).padStart(2, '0')}`;
  const denom = cur.toUpperCase();
  const mUpper = `${MONTH_NAMES[month].toUpperCase()} ${year}`;

  // sel-sel grid (header + tiap minggu: 7 hari + 1 kolom WEEK)
  const gridChildren = [];
  WD.forEach((w) => gridChildren.push(<div className="mo-wd" key={'h' + w}>{w}</div>));
  gridChildren.push(<div className="mo-wd mo-wkh" key="hwk">WEEK</div>);

  for (let wi = 0; wi < numWeeks; wi++) {
    for (let col = 0; col < 7; col++) {
      const day = wi * 7 + col - firstWeekday + 1;
      const key = `c${wi}-${col}`;
      if (day < 1 || day > daysInMonth) {
        gridChildren.push(<div className="mo-cell mo-empty" key={key} />);
        continue;
      }
      const c = M.days[day];
      if (!c) {
        gridChildren.push(<div className="mo-cell mo-none" key={key}><span className="mo-dn">{day}</span></div>);
        continue;
      }
      gridChildren.push(
        <div className={'mo-cell ' + tierClass(c.v, maxAbs)} key={key}>
          <span className="mo-dn">{day}</span>
          <span className="mo-pv">{cval(c.v, compactSym)}</span>
        </div>
      );
    }
    const wt = weekTotals[wi];
    gridChildren.push(
      <div className="mo-wk" key={`w${wi}`}>
        <span className="mo-wkl">W{wi + 1}</span>
        <span className={'mo-wkv ' + pnlCls(wt)}>{cval(wt, compactSym)}</span>
      </div>
    );
  }

  return (
    <div className="mo-card" ref={cardRef}>
      <div className="mo-head">
        <div>
          <div className="mo-prompt">meridian@dlmm:~$ <span className="mo-cmd">dlmm-month {iso}</span></div>
          <div className="mo-title">{mUpper} <span className="mo-denom">· {denom}</span></div>
        </div>
        <div className="mo-net">
          <div className="mo-net-l">net bulan</div>
          <div className={'mo-net-v ' + pnlCls(M.total)}>{cval(M.total, compactSym)}</div>
          <div className="mo-net-l">{winRate}% win · <span className="gr">{M.green}W</span>·<span className="rd">{M.red}L</span></div>
        </div>
      </div>

      <div className="mo-summary">
        <span>fees <span className="gr">{cval(fees, compactSym)}</span></span>
        {hasDays && <span>terbaik <span className="gr">{bestD} ({cval(bestV, compactSym)})</span></span>}
        {hasDays && <span>terburuk <span className="rd">{worstD} ({cval(worstV, compactSym)})</span></span>}
        <span>posisi <span className="br">{pos}</span></span>
      </div>

      <div className="mo-grid">{gridChildren}</div>

      <div className="mo-foot">
        <span className="mo-site">dashboard.dlmm.my.id</span>
        <span className="mo-legend">hijau = profit · merah = rugi · WEEK = total mingguan</span>
      </div>
    </div>
  );
}
