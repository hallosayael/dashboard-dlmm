'use client';

import { useMemo, useState } from 'react';
import { fmtSol, tzYMD, MONTH_NAMES } from '../lib/format';

const TZ = 7; // GMT+7
const WD = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function tierClass(v, maxAbs) {
  const ratio = maxAbs > 0 ? Math.abs(v) / maxAbs : 0;
  const lvl = ratio > 0.66 ? 3 : ratio > 0.33 ? 2 : 1;
  return (v >= 0 ? 'cg' : 'cr') + lvl;
}

export default function Calendar({ positions }) {
  const { byMonth, months } = useMemo(() => {
    const map = {};
    for (const p of positions) {
      const { y, m, d } = tzYMD(p.closedAt, TZ);
      const key = y + '-' + String(m).padStart(2, '0');
      if (!map[key]) map[key] = { y, m, days: {} };
      map[key].days[d] = (map[key].days[d] || 0) + p.pnlSol;
    }
    const months = Object.keys(map).sort();
    for (const k of months) {
      const o = map[k];
      let total = 0, green = 0, red = 0;
      for (const d in o.days) {
        const v = o.days[d];
        total += v;
        if (v >= 0) green++; else red++;
      }
      o.total = total; o.green = green; o.red = red;
    }
    return { byMonth: map, months };
  }, [positions]);

  const [idx, setIdx] = useState(months.length ? months.length - 1 : 0);

  if (months.length === 0) return null;

  const safeIdx = Math.min(idx, months.length - 1);
  const key = months[safeIdx];
  const M = byMonth[key];

  const firstWeekday = new Date(Date.UTC(M.y, M.m, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(M.y, M.m + 1, 0)).getUTCDate();
  let maxAbs = 0;
  for (const d in M.days) maxAbs = Math.max(maxAbs, Math.abs(M.days[d]));
  const winRate = M.green + M.red > 0 ? (M.green / (M.green + M.red)) * 100 : 0;

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(<div key={'b' + i} className="cc ce" />);
  for (let day = 1; day <= daysInMonth; day++) {
    const v = M.days[day];
    if (v === undefined) {
      cells.push(
        <div key={day} className="cc ce">
          <span className="cd">{day}</span>
          <span className="cv" />
        </div>
      );
    } else {
      cells.push(
        <div key={day} className={'cc ' + tierClass(v, maxAbs)} title={fmtSol(v) + ' SOL'}>
          <span className="cd">{day}</span>
          <span className="cv">{fmtSol(v)}</span>
        </div>
      );
    }
  }

  const totalCls = M.total >= 0 ? 'gr' : 'rd';

  return (
    <div className="panel cal-panel">
      <div className="cal-head">
        <span className="plabel">
          ─ calendar · {MONTH_NAMES[M.m]} {M.y} · realized pnl
        </span>
        <span className="cal-meta">
          <span className={totalCls}>{fmtSol(M.total)} SOL</span>
          <span className="dim"> · {M.green} green / {M.red} red · {Math.round(winRate)}% win · </span>
          <button
            className="navbtn"
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={safeIdx === 0}
            aria-label="bulan sebelumnya"
          >‹</button>
          <span className="dim"> {MONTH_NAMES[M.m]} </span>
          <button
            className="navbtn"
            onClick={() => setIdx((i) => Math.min(months.length - 1, i + 1))}
            disabled={safeIdx === months.length - 1}
            aria-label="bulan berikutnya"
          >›</button>
        </span>
      </div>

      <div className="cg wdrow">
        {WD.map((w) => (
          <div key={w} className="wd">{w}</div>
        ))}
      </div>
      <div className="cg">{cells}</div>
    </div>
  );
}
