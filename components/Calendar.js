'use client';

import { useMemo, useState } from 'react';
import { fmtMoney, tzYMD, MONTH_NAMES } from '../lib/format';

const TZ = 7; // GMT+7
const WD = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function tierClass(v, maxAbs) {
  const ratio = maxAbs > 0 ? Math.abs(v) / maxAbs : 0;
  const lvl = ratio > 0.66 ? 3 : ratio > 0.33 ? 2 : 1;
  return (v >= 0 ? 'cg' : 'cr') + lvl;
}

export default function Calendar({ positions, cur, solUsd, usdIdr }) {
  const { byMonth, months } = useMemo(() => {
    const map = {};
    for (const p of positions) {
      const { y, m, d } = tzYMD(p.closedAt, TZ);
      const key = y + '-' + String(m).padStart(2, '0');
      if (!map[key]) map[key] = { y, m, days: {} };
      const cell = map[key].days[d] || (map[key].days[d] = { v: 0, c: 0 });
      cell.v += p.pnlSol;
      cell.c += 1;
    }
    const months = Object.keys(map).sort();
    for (const k of months) {
      const o = map[k];
      let total = 0, green = 0, red = 0;
      for (const d in o.days) {
        const v = o.days[d].v;
        total += v;
        if (v >= 0) green++; else red++;
      }
      o.total = total; o.green = green; o.red = red;
    }
    return { byMonth: map, months };
  }, [positions]);

  const [idx, setIdx] = useState(months.length ? months.length - 1 : 0);

  if (months.length === 0) {
    return <div className="dim" style={{ fontSize: 11, padding: '26px 0', textAlign: 'center' }}>belum ada data kalender</div>;
  }

  const safeIdx = Math.min(idx, months.length - 1);
  const M = byMonth[months[safeIdx]];

  const firstWeekday = new Date(Date.UTC(M.y, M.m, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(M.y, M.m + 1, 0)).getUTCDate();
  let maxAbs = 0;
  for (const d in M.days) maxAbs = Math.max(maxAbs, Math.abs(M.days[d].v));
  const winRate = M.green + M.red > 0 ? (M.green / (M.green + M.red)) * 100 : 0;
  const cval = (v, o) => fmtMoney(v, cur, solUsd, usdIdr, o);

  const numWeeks = Math.ceil((firstWeekday + daysInMonth) / 7);
  const weekTotals = new Array(numWeeks).fill(0);
  const weekdayTotals = new Array(7).fill(0);
  for (let day = 1; day <= daysInMonth; day++) {
    const cell = M.days[day];
    if (!cell) continue;
    const pos = firstWeekday + day - 1;
    weekTotals[Math.floor(pos / 7)] += cell.v;
    weekdayTotals[pos % 7] += cell.v;
  }

  const rows = [];
  for (let wi = 0; wi < numWeeks; wi++) {
    const dayCells = [];
    for (let col = 0; col < 7; col++) {
      const day = wi * 7 + col - firstWeekday + 1;
      if (day < 1 || day > daysInMonth) {
        dayCells.push(<div key={col} className="cc ce" />);
        continue;
      }
      const cell = M.days[day];
      if (!cell) {
        dayCells.push(<div key={col} className="cc ce"><span className="cd">{day}</span></div>);
        continue;
      }
      dayCells.push(
        <div key={col} className={'cc ' + tierClass(cell.v, maxAbs)} title={cval(cell.v, {}) + ' · ' + cell.c + ' pos'}>
          <span className="cd">{day}</span>
          <div className="cc-bot">
            <span className="cpos">{cell.c} pos</span>
            <span className="cv">{cval(cell.v, { compact: true, bare: true })}</span>
          </div>
        </div>
      );
    }
    const wt = weekTotals[wi];
    rows.push(
      <div className="cg8" key={wi}>
        {dayCells}
        <div className="wkcell">
          <span className="wkl">W{wi + 1}</span>
          <span className={'wkv ' + (wt >= 0 ? 'gr' : 'rd')}>{cval(wt, { compact: true, bare: true })}</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="cal-head">
        <span className="plabel" style={{ marginBottom: 0 }}>{MONTH_NAMES[M.m]} {M.y}</span>
        <span className="cal-meta">
          <span className={M.total >= 0 ? 'gr' : 'rd'}>{cval(M.total, {})}</span>
          <span className="dim"> · {M.green} green / {M.red} red · {Math.round(winRate)}% win · </span>
          <button className="navbtn" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={safeIdx === 0} aria-label="bulan sebelumnya">‹</button>
          <span className="dim"> {MONTH_NAMES[M.m]} </span>
          <button className="navbtn" onClick={() => setIdx((i) => Math.min(months.length - 1, i + 1))} disabled={safeIdx === months.length - 1} aria-label="bulan berikutnya">›</button>
        </span>
      </div>

      <div className="cal-scroll">
        <div className="cal-grid">
          <div className="cg8 wdrow">
            {WD.map((w) => <div key={w} className="wd">{w}</div>)}
            <div className="wd wkh">WEEK</div>
          </div>
          {rows}
          <div className="cg8 totrow">
            {weekdayTotals.map((t, ci) => (
              <div key={ci} className="totcell"><span className={t >= 0 ? 'gr' : 'rd'}>{cval(t, { compact: true, bare: true })}</span></div>
            ))}
            <div />
          </div>
        </div>
      </div>
    </div>
  );
}
