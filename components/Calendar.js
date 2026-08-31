'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { fmtMoney, tzYMD, MONTH_NAMES, pnlState, pnlCls } from '../lib/format';
import DailyCard from './DailyCard';
import MonthlyShareModal from './MonthlyShareModal';

const WD = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function tierClass(v) {
  const st = pnlState(v);
  if (st === 0) return 'cb1';        // impas — netral
  return st > 0 ? 'cg3' : 'cr3';     // 1 warna: plus = hijau terang, minus = merah terang
}

export default function Calendar({ positions, cur, solUsd, usdIdr, tz = 7, tzLabel = 'WIB' }) {
  const { byMonth, months } = useMemo(() => {
    const map = {};
    for (const p of positions) {
      const { y, m, d } = tzYMD(p.closedAt, tz);
      const key = y + '-' + String(m).padStart(2, '0');
      if (!map[key]) map[key] = { y, m, days: {} };
      const cell = map[key].days[d] || (map[key].days[d] = { v: 0, c: 0, w: 0, e: 0, f: 0 });
      cell.v += p.pnlSol;
      cell.c += 1;
      cell.f += p.feesSol;
      const ps = pnlState(p.pnlSol);
      if (ps > 0) cell.w += 1; else if (ps === 0) cell.e += 1;
    }
    const months = Object.keys(map).sort();
    for (const k of months) {
      const o = map[k];
      let total = 0, green = 0, red = 0;
      for (const d in o.days) {
        const v = o.days[d].v;
        total += v;
        const st = pnlState(v);
        if (st > 0) green++; else if (st < 0) red++;
      }
      o.total = total; o.green = green; o.red = red;
    }
    return { byMonth: map, months };
  }, [positions, tz]);

  const [idx, setIdx] = useState(months.length ? months.length - 1 : 0);
  const [tip, setTip] = useState(null); // { day, v, c, w, top, left, pinned }
  const [card, setCard] = useState(null); // { day, positions } — kartu recap harian
  const [monthCard, setMonthCard] = useState(false); // kartu pnl bulanan (share)
  const tipTimer = useRef(null); // hover-bridge: jeda tutup saat kursor pindah ke tooltip

  // tutup tooltip yang di-pin (mobile) saat tap di luar
  useEffect(() => {
    if (!tip?.pinned) return;
    const h = (e) => {
      if (!e.target.closest || (!e.target.closest('.cc') && !e.target.closest('.cal-tip'))) setTip(null);
    };
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [tip]);

  if (months.length === 0) {
    return <div className="dim" style={{ fontSize: 11, padding: '26px 0', textAlign: 'center' }}>belum ada data kalender</div>;
  }

  const safeIdx = Math.min(idx, months.length - 1);
  const M = byMonth[months[safeIdx]];

  const firstWeekday = new Date(Date.UTC(M.y, M.m, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(M.y, M.m + 1, 0)).getUTCDate();
  const winRate = M.green + M.red > 0 ? (M.green / (M.green + M.red)) * 100 : 0;
  const cval = (v, o) => fmtMoney(v, cur, solUsd, usdIdr, o);

  const showTip = (day, cell, el, pin) => {
    if (tipTimer.current) { clearTimeout(tipTimer.current); tipTimer.current = null; }
    const r = el.getBoundingClientRect();
    setTip({ day, v: cell.v, c: cell.c, w: cell.w, e: cell.e, f: cell.f, top: r.top, left: r.left + r.width / 2, pinned: pin });
  };

  // beri jeda sebelum menutup tooltip hover, supaya kursor sempat pindah ke
  // dalam tooltip untuk mengklik "buat kartu".
  const scheduleClose = () => {
    if (tipTimer.current) clearTimeout(tipTimer.current);
    tipTimer.current = setTimeout(() => setTip((t) => (t && t.pinned ? t : null)), 180);
  };
  const cancelClose = () => {
    if (tipTimer.current) { clearTimeout(tipTimer.current); tipTimer.current = null; }
  };

  // buka kartu recap untuk satu hari — ambil posisi hari itu dari data yang sama.
  const openCard = (day) => {
    const dayPos = positions.filter((p) => {
      const t = tzYMD(p.closedAt, tz);
      return t.y === M.y && t.m === M.m && t.d === day;
    });
    setTip(null);
    setCard({ day, positions: dayPos });
  };

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
      const dwr = cell.c - cell.e > 0 ? Math.round((cell.w / (cell.c - cell.e)) * 100) + '%' : '—';
      dayCells.push(
        <div
          key={col}
          className={'cc ' + tierClass(cell.v)}
          onMouseEnter={(e) => { if (!tip?.pinned) showTip(day, cell, e.currentTarget, false); }}
          onMouseLeave={() => { if (!tip?.pinned) scheduleClose(); }}
          onClick={(e) => {
            if (tip?.pinned && tip.day === day) setTip(null);
            else showTip(day, cell, e.currentTarget, true);
          }}
        >
          <span className="cd">{day}</span>
          <span className={'cv ' + pnlCls(cell.v)}>{cval(cell.v, { compact: true, bare: true })}</span>
          <span className="cpos">{cell.c} pos · {dwr}</span>
        </div>
      );
    }
    const wt = weekTotals[wi];
    rows.push(
      <div className="cg8" key={wi}>
        {dayCells}
        <div className="wkcell">
          <span className="wkl">W{wi + 1}</span>
          <span className={'wkv ' + pnlCls(wt)}>{cval(wt, { compact: true, bare: true })}</span>
        </div>
      </div>
    );
  }

  const clampedLeft = tip ? Math.max(96, Math.min((typeof window !== 'undefined' ? window.innerWidth : 9999) - 96, tip.left)) : 0;

  return (
    <div>
      <div className="cal-head">
        <span className="plabel" style={{ marginBottom: 0 }}>{MONTH_NAMES[M.m]} {M.y}</span>
        <span className="cal-meta">
          <span className={pnlCls(M.total)}>{cval(M.total, {})}</span>
          <span className="dim"> · {M.green} green / {M.red} red · {Math.round(winRate)}% win · </span>
          <button className="navbtn" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={safeIdx === 0} aria-label="bulan sebelumnya">‹</button>
          <span className="dim"> {MONTH_NAMES[M.m]} </span>
          <button className="navbtn" onClick={() => setIdx((i) => Math.min(months.length - 1, i + 1))} disabled={safeIdx === months.length - 1} aria-label="bulan berikutnya">›</button>
          <button className="cal-share" onClick={() => setMonthCard(true)} title="buat kartu pnl bulanan">↗ share</button>
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
              <div key={ci} className="totcell"><span className={pnlCls(t)}>{cval(t, { compact: true, bare: true })}</span></div>
            ))}
            <div />
          </div>
        </div>
      </div>

      {tip && (
        <div
          className="cal-tip"
          style={{ top: tip.top, left: clampedLeft }}
          onMouseEnter={cancelClose}
          onMouseLeave={() => { if (!tip.pinned) scheduleClose(); }}
        >
          <div className="cal-tip-date">{tip.day} {MONTH_NAMES[M.m]} {M.y}</div>
          <div
            className="cal-tip-row cal-tip-open"
            onClick={(e) => { e.stopPropagation(); openCard(tip.day); }}
            title="klik untuk buat kartu"
          >
            <span className="dim">daily pnl</span>
            <span className={pnlCls(tip.v)}><span className="cv-link">{cval(tip.v, {})}</span></span>
          </div>
          <div className="cal-tip-row"><span className="dim">fees</span><span className="gr">{cval(tip.f, {})}</span></div>
          <div className="cal-tip-row"><span className="dim">positions</span><span>{tip.c} <span className="dim">({tip.w}W / {tip.c - tip.w - tip.e}L{tip.e ? ` / ${tip.e}E` : ''})</span></span></div>
          <div className="cal-tip-row"><span className="dim">win rate</span><span className="br">{tip.c - tip.e > 0 ? Math.round((tip.w / (tip.c - tip.e)) * 100) : 0}%</span></div>
          <div className="cal-tip-hint" onClick={(e) => { e.stopPropagation(); openCard(tip.day); }}>↓ buat kartu harian</div>
        </div>
      )}

      {card && (
        <DailyCard
          positions={card.positions}
          day={card.day}
          month={M.m}
          year={M.y}
          cur={cur}
          solUsd={solUsd}
          usdIdr={usdIdr}
          onClose={() => setCard(null)}
        />
      )}

      {monthCard && (
        <MonthlyShareModal
          positions={positions}
          M={M}
          year={M.y}
          month={M.m}
          cur={cur}
          solUsd={solUsd}
          usdIdr={usdIdr}
          onClose={() => setMonthCard(false)}
        />
      )}
    </div>
  );
}
