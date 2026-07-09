'use client';

import { useEffect, useRef, useState } from 'react';
import { fmtMoney, fmtPct, shortAddr, sinceStr } from '../lib/format';
import { computeHealth, computePools, computeAudit, computeCompare, computeInsight } from '../lib/analytics';

const OVERLAY_COLORS = ['#3fb950', '#39c5cf', '#d29922', '#a99cf5', '#f85149'];
const CMD_LABEL = {
  'wallet-health': 'wallet-health',
  'pool-analysis': 'pool-analysis',
  audit: 'audit',
  compare: 'compare',
  insight: 'insight',
};

export default function AnalyzeModal({
  command, positions, wallets, cur, solUsd, usdIdr, range, walletLabel, onSelectPosition, onClose,
}) {
  const [detailPair, setDetailPair] = useState(null);
  const [overlay, setOverlay] = useState(false);
  const [busy, setBusy] = useState(false);
  const cardRef = useRef(null);

  const m = (sol, o) => fmtMoney(sol, cur, solUsd, usdIdr, o);

  useEffect(() => {
    const h = (e) => {
      if (e.key === 'Escape') {
        if (detailPair) setDetailPair(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [detailPair, onClose]);

  async function exportPng() {
    if (!cardRef.current) return;
    setBusy(true);
    try {
      const { toPng } = await import('html-to-image');
      const url = await toPng(cardRef.current, {
        pixelRatio: 2, backgroundColor: '#0b0e13', skipFonts: true,
      });
      const a = document.createElement('a');
      a.download = `dlmm-${command}-${range}.png`;
      a.href = url;
      a.click();
    } catch (e) {
      alert('gagal membuat gambar: ' + (e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  const echo = 'analyze ' + (CMD_LABEL[command] || command) + (detailPair ? ' ' + detailPair : '');

  let body = null;
  let footer = null;

  if (command === 'wallet-health') {
    const h = computeHealth(positions);
    if (!h) { body = <Empty />; }
    else {
      const barColor = h.status.c === 'gr' ? '#3fb950' : h.status.c === 'am' ? '#d29922' : '#f85149';
      body = (
        <>
          <div className="tp-sec">score</div>
          <div className="tp-score">{h.overall}<small> / 100</small>
            <span className={'tp-badge ' + h.status.c}>{h.status.t}</span>
          </div>
          <div className="tp-track"><div className="tp-fill" style={{ width: h.overall + '%', background: barColor }} /></div>
          {h.grades.map((g) => (
            <div className="tp-row" key={g.k}><span className="lbl">{g.k}</span><span className={'tp-grade ' + g.c}>{g.g}</span></div>
          ))}
          <div className="tp-div" />
          <div className="tp-sec">insight</div>
          {h.insights.map((t, i) => <div className="tp-ins" key={i}>! {t}</div>)}
        </>
      );
    }
    footer = (
      <>
        <button className="fbtn" onClick={exportPng} disabled={busy}><span className="fk">[e]</span> {busy ? 'membuat…' : 'export'}</button>
        <button className="fbtn" onClick={onClose}><span className="fk">[esc]</span> close</button>
      </>
    );
  }

  else if (command === 'pool-analysis') {
    if (detailPair) {
      const list = positions.filter((p) => p.pair === detailPair).sort((a, b) => b.closedAt - a.closedAt);
      body = (
        <>
          <div className="tp-sec">{detailPair} · {list.length} closed</div>
          {list.map((p, i) => {
            const win = p.pnlSol >= 0;
            return (
              <div className="pair-row tp-row" key={p.positionAddress || i} onClick={() => onSelectPosition && onSelectPosition(p)}>
                <span className="lbl">{sinceStr(p.closedAt)} <span className="dim">· fee {m(p.feesSol, { compact: true, unit: false })}</span></span>
                <span className={win ? 'gr' : 'rd'}>{m(p.pnlSol, { compact: true, unit: false })} <span className="dim">{fmtPct(p.pnlPct)}</span></span>
              </div>
            );
          })}
        </>
      );
      footer = <button className="fbtn" onClick={() => setDetailPair(null)}><span className="fk">[esc]</span> back</button>;
    } else {
      const pools = computePools(positions).slice(0, 8);
      body = (
        <>
          <div className="tp-sec">top profit · klik pair untuk detail</div>
          {pools.map((o, i) => {
            const win = o.pnl >= 0;
            return (
              <div className="pair-row" key={o.pair} onClick={() => setDetailPair(o.pair)}>
                <div className="tp-row"><span><span className="dim">{i + 1}</span> <span className="cy">{o.pair}</span></span>
                  <span className={win ? 'gr' : 'rd'}>{m(o.pnl, { compact: true, unit: false })}</span></div>
                <div className="tp-subrow">{o.trades} trade · {Math.round(o.winRate * 100)}% win<span className="tp-chev">›</span></div>
              </div>
            );
          })}
          {!pools.length && <Empty />}
        </>
      );
      footer = <button className="fbtn" onClick={onClose}><span className="fk">[esc]</span> close</button>;
    }
  }

  else if (command === 'audit') {
    const a = computeAudit(positions);
    body = (
      <>
        <div className="tp-row"><span className="lbl">deposit</span><span className="br">{m(a.deposit, { compact: true, sign: false })}</span></div>
        <div className="tp-row"><span className="lbl">withdraw</span><span className="br">{m(a.withdraw, { compact: true, sign: false })}</span></div>
        <div className="tp-row"><span className="lbl">fee earned</span><span className="gr">{m(a.fees, { compact: true })}</span></div>
        <div className="tp-row"><span className="lbl">price impact</span><span className={a.priceImpact >= 0 ? 'gr' : 'rd'}>{m(a.priceImpact, { compact: true })}</span></div>
        <div className="tp-div" />
        <div className="tp-row"><span className="lbl">wallet growth</span><span className={a.growth >= 0 ? 'gr' : 'rd'}>{m(a.growth, { compact: true })}</span></div>
        <div className="tp-row" style={{ alignItems: 'center', marginTop: 4 }}>
          <span className="lbl">audit</span>
          <span className={'tp-badge ' + (a.pass ? 'gr' : 'rd')}>{a.pass ? 'pass ✓' : 'review'}</span>
        </div>
        <div className="tp-ins" style={{ marginTop: 6 }}>{a.pass ? '✓' : '!'} {a.note}</div>
      </>
    );
    footer = <button className="fbtn" onClick={onClose}><span className="fk">[esc]</span> close</button>;
  }

  else if (command === 'compare') {
    const c = computeCompare(positions, wallets);
    if (overlay && !c.single) {
      body = (
        <>
          <div className="tp-sec">overlay equity · {range}</div>
          <OverlayChart curves={c.curves} />
          <div className="tp-legend">
            {c.curves.map((cv, i) => (
              <span key={cv.wallet} className="tp-leg"><span className="tp-dot" style={{ background: OVERLAY_COLORS[i % OVERLAY_COLORS.length] }} />{shortAddr(cv.wallet)}</span>
            ))}
          </div>
        </>
      );
      footer = <button className="fbtn" onClick={() => setOverlay(false)}><span className="fk">[esc]</span> back</button>;
    } else {
      body = (
        <>
          {c.single && <div className="tp-ins" style={{ marginBottom: 8 }}>! hanya 1 wallet — compare butuh ≥2 wallet</div>}
          {c.rows.map((r, i) => (
            <div className="tp-row" key={r.wallet}>
              <span className="lbl"><span className="dim">{String.fromCharCode(65 + i)}</span> {shortAddr(r.wallet)} <span className="dim">· {r.n}</span></span>
              <span className={r.pnl >= 0 ? 'gr' : 'rd'}>{m(r.pnl, { compact: true, unit: false })}</span>
            </div>
          ))}
          <div className="tp-div" />
          <div className="tp-row"><span className="br">combined</span><span className={c.combined >= 0 ? 'gr' : 'rd'}>{m(c.combined, { compact: true })}</span></div>
          <div className="tp-row"><span className="lbl">winrate</span><span className="br">{Math.round(c.winRate * 100)}%</span></div>
        </>
      );
      footer = (
        <>
          {!c.single && <button className="fbtn" onClick={() => setOverlay(true)}><span className="fk">[o]</span> overlay</button>}
          <button className="fbtn" onClick={onClose}><span className="fk">[esc]</span> close</button>
        </>
      );
    }
  }

  else if (command === 'insight') {
    const s = computeInsight(positions);
    if (!s) { body = <Empty />; }
    else {
      body = (
        <>
          <div className="tp-sec">analysis</div>
          <div className="tp-narr">
            Wallet menghasilkan <span className="gr">{m(s.totalFees, { compact: true })}</span> fee.{' '}
            <span className={s.ilRatio >= 0.5 ? 'rd' : 'br'}>{Math.round(s.ilRatio * 100)}%</span> tergerus IL.{' '}
            {s.bestPool && <>Pool terbaik <span className="cy">{s.bestPool.pair}</span>.{' '}</>}
            Rata-rata posisi <span className="br">{s.avgHoldMin} menit</span>.{' '}
            {s.longWorse ? 'Hold >2 jam performa lebih rendah.' : 'Durasi hold relatif konsisten.'}
          </div>
          <div className="tp-div" />
          <div className="tp-sec">suggestion</div>
          <div className="tp-sugg">→ {s.suggestion}</div>
        </>
      );
    }
    footer = <button className="fbtn" onClick={onClose}><span className="fk">[esc]</span> close</button>;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="tpop" onClick={(e) => e.stopPropagation()}>
        <div className="tp-scroll" ref={cardRef}>
          <div className="tp-echo">
            <span className="gr">meridian@dlmm</span><span className="dim">:</span>
            <span className="cy">~</span><span className="dim">$</span> {echo}
          </div>
          {body}
          <div className="tp-cursorline">$ <span className="tp-cursor" /></div>
        </div>
        <div className="tp-foot">{footer}</div>
      </div>
    </div>
  );
}

function Empty() {
  return <div className="dim" style={{ padding: '18px 0', textAlign: 'center', fontSize: 11 }}>belum cukup data pada rentang ini</div>;
}

// Overlay equity curve semua wallet dalam satu chart.
function OverlayChart({ curves }) {
  const W = 380, H = 150, padT = 8, padB = 8, padX = 4;
  const all = curves.flatMap((c) => c.pts);
  if (all.length < 2) return <Empty />;
  const ts = all.map((p) => p.t), vs = all.map((p) => p.v);
  const tmin = Math.min(...ts), tmax = Math.max(...ts);
  let vmin = Math.min(0, ...vs), vmax = Math.max(0, ...vs);
  if (vmax === vmin) { vmax += 0.001; vmin -= 0.001; }
  const x = (t) => padX + (tmax === tmin ? W / 2 : ((t - tmin) / (tmax - tmin)) * (W - padX * 2));
  const y = (v) => padT + ((vmax - v) / (vmax - vmin)) * (H - padT - padB);
  const y0 = y(0);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label="overlay equity curve">
      <line x1="0" y1={y0} x2={W} y2={y0} stroke="#2a3038" strokeWidth="1" strokeDasharray="3 4" />
      {curves.map((c, i) => {
        if (c.pts.length < 2) return null;
        const d = c.pts.map((p, j) => `${j === 0 ? 'M' : 'L'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
        return <path key={c.wallet} d={d} fill="none" stroke={OVERLAY_COLORS[i % OVERLAY_COLORS.length]} strokeWidth="1.8" strokeLinejoin="round" />;
      })}
    </svg>
  );
}
