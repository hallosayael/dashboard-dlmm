'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { fmtMoney, shortAddr } from '../lib/format';

const RANGE_LABEL = { '7d': 'LAST 7 DAYS', '30d': 'LAST 30 DAYS', all: 'ALL TIME' };
const PALETTE = ['#d4a24e', '#52b98a', '#df7a72', '#e0a75e', '#58a6ff', '#b48ead', '#8b7ff0', '#39c5cf'];

function iconUrl(u) {
  return u ? `/api/icon?u=${encodeURIComponent(u)}` : '';
}
function fmtHold(sec) {
  if (!sec || sec <= 0) return '—';
  const h = sec / 3600;
  if (h >= 24) return (h / 24).toFixed(1) + 'd';
  if (h >= 1) return h.toFixed(1) + 'h';
  return Math.round(sec / 60) + 'm';
}

export default function RecapCard({ positions, cur, solUsd, usdIdr, range, wallet, onClose }) {
  const cardRef = useRef(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const m = (sol, o) => fmtMoney(sol, cur, solUsd, usdIdr, o);

  const data = useMemo(() => {
    const sorted = [...positions].sort((a, b) => a.closedAt - b.closedAt);
    const pts = [{ v: 0, pos: null }];
    let cum = 0;
    for (const p of sorted) { cum += p.pnlSol; pts.push({ v: cum, pos: p }); }

    const n = positions.length;
    const wins = positions.filter((p) => p.pnlSol > 0).length;
    const totalPnl = cum;
    const totalFees = positions.reduce((a, p) => a + p.feesSol, 0);
    const volume = positions.reduce((a, p) => a + p.depositSol, 0);
    const best = positions.reduce((mx, p) => Math.max(mx, p.pnlSol), 0);
    const holdSecs = positions.filter((p) => p.createdAt && p.closedAt).map((p) => p.closedAt - p.createdAt);
    const avgHold = holdSecs.length ? holdSecs.reduce((a, b) => a + b, 0) / holdSecs.length : 0;

    // pilih marker: sampai 14 posisi terbesar (|pnl|) + titik terakhir
    const idxByImpact = pts.map((pt, i) => ({ i, imp: pt.pos ? Math.abs(pt.pos.pnlSol) : -1 }))
      .filter((o) => o.i > 0)
      .sort((a, b) => b.imp - a.imp)
      .slice(0, 14)
      .map((o) => o.i);
    const markerSet = new Set(idxByImpact);
    markerSet.add(pts.length - 1);
    const pillSet = new Set(idxByImpact.slice(0, 5));

    return { pts, n, wins, winRate: n ? (wins / n) * 100 : 0, totalPnl, totalFees, volume, best, avgHold, markerSet, pillSet };
  }, [positions]);

  const { pts } = data;
  const W = 600, H = 190, pl = 14, pr = 14, pt = 22, pb = 14;
  const vs = pts.map((p) => p.v);
  let vMin = Math.min(0, ...vs), vMax = Math.max(0, ...vs);
  if (vMax === vMin) { vMax += 0.001; vMin -= 0.001; }
  const padV = (vMax - vMin) * 0.12;
  vMin -= padV; vMax += padV;
  const iW = W - pl - pr, iH = H - pt - pb;
  const X = (i) => pl + (pts.length > 1 ? (i / (pts.length - 1)) * iW : iW / 2);
  const Y = (v) => pt + ((vMax - v) / (vMax - vMin)) * iH;
  const y0 = Y(0);

  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ');
  const area = line + ` L${X(pts.length - 1).toFixed(1)},${y0.toFixed(1)} L${X(0).toFixed(1)},${y0.toFixed(1)} Z`;
  const totalCls = data.totalPnl >= 0 ? 'gr' : 'rd';

  async function download() {
    if (!cardRef.current) return;
    setBusy(true);
    try {
      const { toPng } = await import('html-to-image');
      const node = cardRef.current;
      const url = await toPng(node, {
        pixelRatio: 2,
        width: node.offsetWidth,
        height: node.offsetHeight,
        backgroundColor: '#0e1116',
        cacheBust: true,
      });
      const a = document.createElement('a');
      a.download = `dlmm-recap-${range}.png`;
      a.href = url;
      a.click();
    } catch (e) {
      console.error(e);
      alert('gagal membuat gambar — coba screenshot manual');
    }
    setBusy(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="recap-wrap" onClick={(e) => e.stopPropagation()}>
        <div className="recap-card" ref={cardRef}>
          <div className="recap-top">
            <div>
              <div className="recap-kicker">{RANGE_LABEL[range] || range} · PNL</div>
              <div className="dim recap-sub">{data.n} posisi · {Math.round(data.winRate)}% win</div>
            </div>
            <div className={'recap-total ' + totalCls}>{m(data.totalPnl, { dp: 3 })}</div>
          </div>

          <div className="recap-chartwrap">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="recap-svg" role="img" aria-label="equity curve recap">
            <defs>
              <linearGradient id="recapfill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#8b7ff0" stopOpacity="0.32" />
                <stop offset="1" stopColor="#6b5bd0" stopOpacity="0.03" />
              </linearGradient>
            </defs>
            <line x1="0" y1={y0} x2={W} y2={y0} stroke="#2a3038" strokeWidth="1" strokeDasharray="4 4" />
            <path d={area} fill="url(#recapfill)" />
            <path d={line} fill="none" stroke="#52b98a" strokeWidth="2.2" strokeLinejoin="round" />

            {pts.map((p, i) => {
              if (!data.markerSet.has(i) || !p.pos) return null;
              const cx = X(i), cy = Y(p.v), r = 9;
              const showPill = data.pillSet.has(i);
              const winP = p.pos.pnlSol >= 0;
              return (
                <g key={i}>
                  {showPill && (
                    <g>
                      <rect x={cx - 26} y={winP ? cy - 30 : cy + 14} width="52" height="15" rx="4" fill={winP ? '#e7ebf2' : '#3a1718'} />
                      <text x={cx} y={winP ? cy - 19 : cy + 25} fontSize="9" textAnchor="middle" fill={winP ? '#166a45' : '#df7a72'}>{m(p.pos.pnlSol, { dp: 3, bare: true })}</text>
                    </g>
                  )}
                  {!p.pos.icon && (
                    <>
                      <circle cx={cx} cy={cy} r={r} fill={PALETTE[i % PALETTE.length]} stroke="#0b0e13" strokeWidth="1.5" />
                      <text x={cx} y={cy + 3.5} fontSize="9" textAnchor="middle" fill="#0b0e13" fontWeight="500">{(p.pos.pair || '?')[0]}</text>
                    </>
                  )}
                </g>
              );
            })}
          </svg>
          {pts.map((p, i) => {
            if (!data.markerSet.has(i) || !p.pos || !p.pos.icon) return null;
            return (
              <img key={i} className="recap-marker" src={iconUrl(p.pos.icon)} alt=""
                style={{ left: (X(i) / W * 100) + '%', top: (Y(p.v) / H * 100) + '%' }} />
            );
          })}
          </div>

          <div className="recap-stats">
            <div><div className="rl">VOLUME</div><div className="gr">{m(data.volume, { sign: false, bare: true, dp: 1 })}</div></div>
            <div><div className="rl">WIN RATE</div><div>{Math.round(data.winRate)}%</div></div>
            <div><div className="rl">FEES</div><div className="gr">{m(data.totalFees, { bare: true, dp: 2 })}</div></div>
            <div><div className="rl">BEST</div><div className="gr">{m(data.best, { bare: true, dp: 3 })}</div></div>
            <div><div className="rl">POSISI</div><div>{data.n}</div></div>
            <div><div className="rl">AVG HOLD</div><div>{fmtHold(data.avgHold)}</div></div>
          </div>

          <div className="recap-brand">
            <span>dashboard.dlmm.my.id</span>
            <span className="dim">{shortAddr(wallet)} · denom {cur}</span>
          </div>
        </div>

        <div className="recap-actions">
          <button className="recap-dl" onClick={download} disabled={busy}>{busy ? 'membuat…' : '↓ download png'}</button>
          <button className="recap-close" onClick={onClose}>tutup</button>
        </div>
      </div>
    </div>
  );
}
