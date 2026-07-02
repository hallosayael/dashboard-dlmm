'use client';

import { useEffect, useState } from 'react';
import { fmtMoney } from '../lib/format';

function fmtPriceShort(n) {
  n = Number(n);
  if (!n || !Number.isFinite(n)) return '—';
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (n >= 1) return n.toFixed(3);
  if (n >= 0.001) return n.toPrecision(3);
  return n.toExponential(2);
}

function holdStr(sec) {
  if (!sec || sec < 0) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h >= 24) return Math.floor(h / 24) + 'd ' + (h % 24) + 'h';
  if (h > 0) return h + 'h ' + m + 'm';
  return m + 'm';
}

function priceAt(cs, t) {
  if (!cs.length) return null;
  let b = cs[0];
  for (const c of cs) { if (c.t <= t) b = c; else break; }
  return b.c;
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// pill dua-bagian: tag dark grey + nilai terang (HIGH/LOW)
function PillTwo({ x, y, tag, value }) {
  const tagW = tag.length * 6.2 + 12;
  const valW = value.length * 5.8 + 12;
  return (
    <g>
      <rect x={x} y={y - 9} width={tagW} height={18} rx="4" fill="#3a424c" />
      <text x={x + 6} y={y + 3.5} fontSize="9" fill="#dfe4ec">{tag}</text>
      <rect x={x + tagW + 2} y={y - 9} width={valW} height={18} rx="4" fill="#e7ebf2" />
      <text x={x + tagW + 2 + 6} y={y + 3.5} fontSize="9.5" fill="#0f1622">{value}</text>
    </g>
  );
}

// pill label terang (ENTRY/EXIT) tanpa harga, rata kanan
function PillLabel({ rightX, y, text }) {
  const w = text.length * 6.6 + 16;
  const x = rightX - w;
  return (
    <g>
      <rect x={x} y={y - 9} width={w} height={18} rx="4" fill="#e7ebf2" />
      <text x={x + w / 2} y={y + 3.5} fontSize="9.5" fill="#0f1622" textAnchor="middle">{text}</text>
    </g>
  );
}

export default function PositionModal({ position, cur, solUsd, usdIdr, onClose }) {
  const p = position;
  const [oh, setOh] = useState({ loading: true, candles: [], timeframe: '', error: null });

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  useEffect(() => {
    if (!p) return;
    let alive = true;
    setOh({ loading: true, candles: [], timeframe: '', error: null });
    const to = p.closedAt || Math.floor(Date.now() / 1000);
    fetch(`/api/ohlcv?pool=${encodeURIComponent(p.poolAddress)}&from=${p.createdAt}&to=${to}`)
      .then((r) => r.json())
      .then((j) => { if (alive) setOh({ loading: false, candles: j.candles || [], timeframe: j.timeframe || '', error: j.error || null }); })
      .catch((e) => { if (alive) setOh({ loading: false, candles: [], timeframe: '', error: String(e) }); });
    return () => { alive = false; };
  }, [p]);

  if (!p) return null;
  const m = (sol, o) => fmtMoney(sol, cur, solUsd, usdIdr, o);
  const win = p.pnlSol >= 0;
  const hold = holdStr(p.closedAt - p.createdAt);

  const cs = [...oh.candles].sort((a, b) => a.t - b.t);
  const hasRange = p.minPrice > 0 && p.maxPrice > p.minPrice;
  const entryP = cs.length ? priceAt(cs, p.createdAt) : null;
  const exitP = cs.length ? priceAt(cs, p.closedAt) : null;
  const refP = exitP ?? (p.activePrice || null);
  let badge = null;
  if (hasRange && refP) {
    if (refP > p.maxPrice) badge = { t: 'out of range (harga di atas)', c: 'rd' };
    else if (refP < p.minPrice) badge = { t: 'out of range (harga di bawah)', c: 'rd' };
    else badge = { t: 'in range', c: 'gr' };
  }

  let chart = null;
  if (cs.length) {
    const W = 440, H = 214, pl = 6, pr = 6, pt = 52, pb = 22; // pt besar = ruang badge
    const RX = Math.round(W * 0.56);
    const VX = Math.round(W * 0.9);
    const prices = [];
    for (const c of cs) prices.push(c.h, c.l);
    if (hasRange) prices.push(p.minPrice, p.maxPrice);
    if (entryP) prices.push(entryP);
    if (exitP) prices.push(exitP);
    let pMin = Math.min(...prices), pMax = Math.max(...prices);
    if (pMax === pMin) { pMax *= 1.01; pMin *= 0.99; }
    const padP = (pMax - pMin) * 0.06 || pMax * 0.01;
    pMin -= padP; pMax += padP;
    const iW = W - pl - pr, iH = H - pt - pb;
    const n = cs.length, step = iW / n;
    const cx = (i) => pl + step * (i + 0.5);
    const y = (v) => pt + ((pMax - v) / (pMax - pMin)) * iH;
    const yEntry = entryP ? y(entryP) : null;
    const yExit = exitP ? y(exitP) : null;
    let peY = yEntry != null ? clamp(yEntry, pt + 2, H - 11) : null;
    let pxY = yExit != null ? clamp(yExit, pt + 2, H - 11) : null;
    if (peY != null && pxY != null && Math.abs(peY - pxY) < 19) {
      const mid = (peY + pxY) / 2;
      if (peY <= pxY) { peY = mid - 10; pxY = mid + 10; } else { peY = mid + 10; pxY = mid - 10; }
      peY = clamp(peY, pt + 2, H - 11); pxY = clamp(pxY, pt + 2, H - 11);
    }
    chart = {
      W, H, pt, pb, RX, VX, cx, y, bw: Math.max(3, Math.min(14, step * 0.6)),
      yHigh: hasRange ? y(p.maxPrice) : null, yLow: hasRange ? y(p.minPrice) : null,
      yEntry, yExit, peY, pxY,
    };
  }

  const meteora = 'https://app.meteora.ag/dlmm/' + p.poolAddress;
  const solscan = p.positionAddress ? 'https://solscan.io/account/' + p.positionAddress : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card term" onClick={(e) => e.stopPropagation()}>
        <div className="bar">
          <span className="dot" style={{ background: '#f85149' }} />
          <span className="dot" style={{ background: '#d29922' }} />
          <span className="dot" style={{ background: '#3fb950' }} />
          <span className="ttl">position · {p.pair}</span>
          <button className="modal-x" onClick={onClose} aria-label="tutup">✕</button>
        </div>

        <div className="modal-body">
          <div className="md-head">
            <div>
              <div className="md-pair">{p.pair}</div>
              <div className="dim md-sub">hold {hold}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className={'md-pnl ' + (win ? 'gr' : 'rd')}>{p.pnlPct >= 0 ? '+' : ''}{Math.round(p.pnlPct)}%</div>
              <div className={win ? 'gr' : 'rd'} style={{ fontSize: 12, marginTop: 3 }}>{m(p.pnlSol, {})}</div>
            </div>
          </div>

          <div className="md-chart">
            {badge && !oh.loading && cs.length > 0 && <span className={'md-badge ' + badge.c}>● {badge.t}</span>}
            {oh.loading ? (
              <div className="md-chart-msg">memuat chart…</div>
            ) : cs.length === 0 ? (
              <div className="md-chart-msg">chart tidak tersedia untuk pool ini</div>
            ) : (
              <svg viewBox={`0 0 ${chart.W} ${chart.H}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label="candlestick posisi">
                <defs>
                  <linearGradient id="rngbox" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#8b7ff0" stopOpacity="0.34" />
                    <stop offset="1" stopColor="#6b5bd0" stopOpacity="0.07" />
                  </linearGradient>
                </defs>

                {hasRange && (
                  <>
                    <rect x={chart.RX} y={chart.yHigh} width={chart.W - chart.RX} height={Math.max(0, chart.yLow - chart.yHigh)} fill="url(#rngbox)" />
                    <line x1={chart.RX} y1={chart.pt - 6} x2={chart.RX} y2={chart.H - chart.pb + 6} stroke="#8b7ff0" strokeWidth="1" opacity="0.35" />
                    <line x1="0" y1={chart.yHigh} x2={chart.W} y2={chart.yHigh} stroke="#c9d1d9" strokeWidth="1" strokeDasharray="5 4" opacity="0.45" />
                    <line x1="0" y1={chart.yLow} x2={chart.W} y2={chart.yLow} stroke="#c9d1d9" strokeWidth="1" strokeDasharray="5 4" opacity="0.45" />
                  </>
                )}

                {/* candles soft */}
                {cs.map((c, i) => {
                  const col = c.c >= c.o ? '#52b98a' : '#df7a72';
                  const x = chart.cx(i);
                  const yo = chart.y(c.o), yc = chart.y(c.c);
                  return (
                    <g key={i}>
                      <line x1={x} y1={chart.y(c.h)} x2={x} y2={chart.y(c.l)} stroke={col} strokeWidth="1" />
                      <rect x={x - chart.bw / 2} y={Math.min(yo, yc)} width={chart.bw} height={Math.max(1, Math.abs(yo - yc))} fill={col} />
                    </g>
                  );
                })}

                {/* garis vertikal kanan + titik entry/exit */}
                <line x1={chart.VX} y1={chart.pt - 6} x2={chart.VX} y2={chart.H - 8} stroke="#c9d1d9" strokeWidth="1" strokeDasharray="4 4" opacity="0.45" />
                {chart.yExit != null && Math.abs(chart.pxY - chart.yExit) > 2 && <line x1={chart.VX} y1={chart.yExit} x2={chart.VX - 6} y2={chart.pxY} stroke="#8b949e" strokeWidth="1" opacity="0.5" />}
                {chart.yEntry != null && Math.abs(chart.peY - chart.yEntry) > 2 && <line x1={chart.VX} y1={chart.yEntry} x2={chart.VX - 6} y2={chart.peY} stroke="#8b949e" strokeWidth="1" opacity="0.5" />}
                {chart.yExit != null && <circle cx={chart.VX} cy={chart.yExit} r="5" fill="#0b0e13" stroke="#e6edf3" strokeWidth="2" />}
                {chart.yEntry != null && <circle cx={chart.VX} cy={chart.yEntry} r="5" fill="#0b0e13" stroke="#e6edf3" strokeWidth="2" />}

                {/* pills */}
                {hasRange && <PillTwo x={4} y={clamp(chart.yHigh, chart.pt, chart.H - 11)} tag="HIGH" value={fmtPriceShort(p.maxPrice)} />}
                {hasRange && <PillTwo x={4} y={clamp(chart.yLow, chart.pt, chart.H - 11)} tag="LOW" value={fmtPriceShort(p.minPrice)} />}
                {chart.yExit != null && <PillLabel rightX={chart.VX - 8} y={chart.pxY} text="EXIT" />}
                {chart.yEntry != null && <PillLabel rightX={chart.VX - 8} y={chart.peY} text="ENTRY" />}
              </svg>
            )}
            <div className="md-chart-note">
              {cs.length > 0 && <>candle {oh.timeframe} · </>}<span style={{ color: '#a99cf5' }}>kotak</span> = range bin · badge = status harga vs range
            </div>
          </div>

          <div className="md-inforow">
            <span>deposit <span className="br">{m(p.depositSol, { bare: true, compact: true, sign: false })}</span></span>
            <span>withdraw <span className="br">{m(p.withdrawSol, { bare: true, compact: true, sign: false })}</span></span>
            <span>fees <span className="gr">{m(p.feesSol, { bare: true, compact: true })}</span></span>
            <span>net <span className={win ? 'gr' : 'rd'}>{m(p.pnlSol, { bare: true, compact: true })}</span></span>
          </div>
          <div className="md-inforow bt">
            <span>bin step <span className="br">{p.binStep ?? '—'}</span></span>
            <span>bins <span className="br">{p.bins ?? '—'}</span></span>
            <span>base fee <span className="br">{p.baseFee != null ? p.baseFee + '%' : '—'}</span></span>
          </div>

          <div className="md-actions">
            <a className="md-btn" href={meteora} target="_blank" rel="noreferrer">↗ Meteora</a>
            {solscan && <a className="md-btn" href={solscan} target="_blank" rel="noreferrer">↗ Solscan</a>}
          </div>
          <div className="md-hint dim">klik ✕ / luar kartu / Esc buat tutup</div>
        </div>
      </div>
    </div>
  );
}
