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
function idxAt(cs, t) {
  let bi = 0;
  for (let i = 0; i < cs.length; i++) { if (cs[i].t <= t) bi = i; else break; }
  return bi;
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
    const W = 440, H = 200, pl = 6, pr = 6, pt = 16, pb = 10;
    const prices = [];
    for (const c of cs) prices.push(c.h, c.l);
    if (hasRange) prices.push(p.minPrice, p.maxPrice);
    if (entryP) prices.push(entryP);
    if (exitP) prices.push(exitP);
    let pMin = Math.min(...prices), pMax = Math.max(...prices);
    if (pMax === pMin) { pMax *= 1.01; pMin *= 0.99; }
    const padP = (pMax - pMin) * 0.08 || pMax * 0.01;
    pMin -= padP; pMax += padP;
    const iW = W - pl - pr, iH = H - pt - pb;
    const n = cs.length, step = iW / n;
    const cx = (i) => pl + step * (i + 0.5);
    const y = (v) => pt + ((pMax - v) / (pMax - pMin)) * iH;
    chart = {
      W, H, cx, y,
      bw: Math.max(2, Math.min(13, step * 0.6)),
      yHigh: hasRange ? y(p.maxPrice) : null,
      yLow: hasRange ? y(p.minPrice) : null,
      ei: idxAt(cs, p.createdAt), xi: idxAt(cs, p.closedAt),
      yEntry: entryP ? y(entryP) : null, yExit: exitP ? y(exitP) : null,
    };
  }
  const anchor = (x, W) => (x < 54 ? 'start' : x > W - 54 ? 'end' : 'middle');

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
                {hasRange && (
                  <>
                    <rect x="0" y={chart.yHigh} width={chart.W} height={Math.max(0, chart.yLow - chart.yHigh)} fill="#8b7ff0" opacity="0.13" />
                    <line x1="0" y1={chart.yHigh} x2={chart.W} y2={chart.yHigh} stroke="#c9d1d9" strokeWidth="1" strokeDasharray="5 4" opacity="0.5" />
                    <line x1="0" y1={chart.yLow} x2={chart.W} y2={chart.yLow} stroke="#c9d1d9" strokeWidth="1" strokeDasharray="5 4" opacity="0.5" />
                  </>
                )}
                {cs.map((c, i) => {
                  const col = c.c >= c.o ? '#3fb950' : '#f85149';
                  const x = chart.cx(i);
                  const yo = chart.y(c.o), yc = chart.y(c.c);
                  return (
                    <g key={i}>
                      <line x1={x} y1={chart.y(c.h)} x2={x} y2={chart.y(c.l)} stroke={col} strokeWidth="1" />
                      <rect x={x - chart.bw / 2} y={Math.min(yo, yc)} width={chart.bw} height={Math.max(1, Math.abs(yo - yc))} fill={col} />
                    </g>
                  );
                })}
                {hasRange && (
                  <>
                    <text x="6" y={Math.max(11, chart.yHigh - 4)} fontSize="9.5" fill="#a99cf5" stroke="#0b0e13" strokeWidth="2.5" style={{ paintOrder: 'stroke' }}>HIGH {fmtPriceShort(p.maxPrice)}</text>
                    <text x="6" y={Math.min(chart.H - 3, chart.yLow + 12)} fontSize="9.5" fill="#a99cf5" stroke="#0b0e13" strokeWidth="2.5" style={{ paintOrder: 'stroke' }}>LOW {fmtPriceShort(p.minPrice)}</text>
                  </>
                )}
                {chart.yEntry != null && (
                  <>
                    <line x1={chart.cx(chart.ei)} y1="12" x2={chart.cx(chart.ei)} y2={chart.H - 6} stroke="#3fb950" strokeWidth="1" strokeDasharray="3 3" opacity="0.4" />
                    <circle cx={chart.cx(chart.ei)} cy={chart.yEntry} r="4.5" fill="#3fb950" stroke="#0b0e13" strokeWidth="1.5" />
                    <text x={chart.cx(chart.ei)} y={chart.yEntry - 8} fontSize="9" fill="#3fb950" textAnchor={anchor(chart.cx(chart.ei), chart.W)} stroke="#0b0e13" strokeWidth="2.5" style={{ paintOrder: 'stroke' }}>entry {fmtPriceShort(entryP)}</text>
                  </>
                )}
                {chart.yExit != null && (
                  <>
                    <line x1={chart.cx(chart.xi)} y1="12" x2={chart.cx(chart.xi)} y2={chart.H - 6} stroke="#e6edf3" strokeWidth="1" strokeDasharray="3 3" opacity="0.35" />
                    <circle cx={chart.cx(chart.xi)} cy={chart.yExit} r="4.5" fill="#e6edf3" stroke="#0b0e13" strokeWidth="1.5" />
                    <text x={chart.cx(chart.xi)} y={chart.yExit - 8} fontSize="9" fill="#e6edf3" textAnchor={anchor(chart.cx(chart.xi), chart.W)} stroke="#0b0e13" strokeWidth="2.5" style={{ paintOrder: 'stroke' }}>exit {fmtPriceShort(exitP)}</text>
                  </>
                )}
              </svg>
            )}
            <div className="md-chart-note">
              {cs.length > 0 && <>candle {oh.timeframe} · </>}<span style={{ color: '#a99cf5' }}>kotak</span> = range bin · <span style={{ color: '#3fb950' }}>●</span> entry · <span style={{ color: '#e6edf3' }}>●</span> exit
            </div>
          </div>

          <div className="md-grid">
            <div className="md-row"><span className="dim">deposit</span><span>{m(p.depositSol, { sign: false })}</span></div>
            <div className="md-row"><span className="dim">withdraw</span><span>{m(p.withdrawSol, { sign: false })}</span></div>
            <div className="md-row"><span className="dim">fees</span><span className="gr">{m(p.feesSol, {})}</span></div>
            <div className="md-row"><span className="dim">net pnl</span><span className={win ? 'gr' : 'rd'}>{m(p.pnlSol, {})}</span></div>
            <div className="md-row"><span className="dim">bins</span><span>{p.bins ?? '—'}</span></div>
            <div className="md-row"><span className="dim">bin step</span><span>{p.binStep ?? '—'}</span></div>
            <div className="md-row"><span className="dim">base fee</span><span>{p.baseFee != null ? p.baseFee + '%' : '—'}</span></div>
            <div className="md-row"><span className="dim">status</span><span className={win ? 'gr' : 'rd'}>{win ? 'profit ✓' : 'loss ✗'}</span></div>
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
