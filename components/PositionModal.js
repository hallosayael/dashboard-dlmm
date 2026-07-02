'use client';

import { useEffect } from 'react';
import { fmtMoney } from '../lib/format';

function fmtPrice(p) {
  const n = Number(p);
  if (!n || !Number.isFinite(n)) return '—';
  if (n >= 1) return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
  return n.toPrecision(4);
}

function holdStr(sec) {
  if (!sec || sec < 0) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h >= 24) return Math.floor(h / 24) + 'd ' + (h % 24) + 'h';
  if (h > 0) return h + 'h ' + m + 'm';
  return m + 'm';
}

export default function PositionModal({ position, cur, solUsd, usdIdr, onClose }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  if (!position) return null;
  const p = position;
  const m = (sol, o) => fmtMoney(sol, cur, solUsd, usdIdr, o);
  const win = p.pnlSol >= 0;
  const hold = holdStr(p.closedAt - p.createdAt);

  const hasRange = p.minPrice > 0 && p.maxPrice > p.minPrice;
  const inRange = hasRange && p.activePrice >= p.minPrice && p.activePrice <= p.maxPrice;
  const markerPct = hasRange
    ? Math.max(0, Math.min(100, ((p.activePrice - p.minPrice) / (p.maxPrice - p.minPrice)) * 100))
    : 50;

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

          {hasRange && (
            <div className="md-range">
              <div className="md-range-head">
                <span className="dim">─ price range (bin)</span>
                <span className="dim">{inRange ? 'harga skrg di dalam range' : 'harga skrg di luar range'}</span>
              </div>
              <div className="md-bar">
                <div className="md-mark" style={{ left: markerPct + '%' }} />
              </div>
              <div className="md-range-lbl">
                <span><span className="dim">low </span>{fmtPrice(p.minPrice)}</span>
                <span><span className="dim">high </span>{fmtPrice(p.maxPrice)}</span>
              </div>
            </div>
          )}

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
