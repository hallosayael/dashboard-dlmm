'use client';

import { useEffect, useRef, useState } from 'react';
import { fmtMoney, fmtPct, shortAddr, sinceStr, pnlCls } from '../lib/format';
import { computeHealth, computePools, computeAudit, computeCompare, computeInsight } from '../lib/analytics';
import HealthCard from './HealthCard';

const OVERLAY_COLORS = ['#3fb950', '#39c5cf', '#d29922', '#a99cf5', '#f85149'];

// Versi prompt — naikkan kalau prompt di /api/insight diubah, biar cache lama batal.
const AI_PROMPT_V = 'v2';

// Kunci cache = sidik jari METRIK (bukan alamat wallet). Kalau ada posisi baru
// closed / range diganti, metrik berubah -> kunci berubah -> LLM dipanggil ulang.
// Jadi cache tidak mungkin basi.
function aiCacheKey(s, range) {
  const r = (x, d = 4) => Math.round((Number(x) || 0) * 10 ** d) / 10 ** d;
  return [
    'insight', AI_PROMPT_V, range, s.n,
    r(s.totalPnl), r(s.totalFees), r(s.ilRatio, 3),
    s.avgHoldMin, s.overall,
    s.bestPool?.pair || '-', s.worstPool?.pair || '-',
  ].join('|');
}
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
  const [ai, setAi] = useState({ loading: false, analisa: '', saran: '', off: false });
  const cardRef = useRef(null);
  // kartu share khusus PNG (wallet-health) — bukan popup di layar
  const healthRef = useRef(null);

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

  // Tab "insight": minta narasi ke LLM. Angka tetap dihitung lokal (deterministik);
  // LLM hanya menarasikan. Kalau gagal / key tak ada -> fallback teks rule-based.
  useEffect(() => {
    if (command !== 'insight') return;
    const s = computeInsight(positions);
    if (!s) return;

    // cache berbasis sidik jari metrik -> tak mungkin menyajikan data basi
    const key = aiCacheKey(s, range);
    try {
      const hit = sessionStorage.getItem(key);
      if (hit) {
        const j = JSON.parse(hit);
        setAi({ loading: false, analisa: j.analisa, saran: j.saran || '', off: false });
        return;
      }
    } catch (_) { /* sessionStorage tak tersedia — lanjut fetch */ }

    let alive = true;
    setAi({ loading: true, analisa: '', saran: '', off: false });
    fetch('/api/insight', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...s, range }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j?.analisa) {
          setAi({ loading: false, analisa: j.analisa, saran: j.saran || '', off: false });
          try { sessionStorage.setItem(key, JSON.stringify({ analisa: j.analisa, saran: j.saran || '' })); } catch (_) {}
        } else {
          setAi({ loading: false, analisa: '', saran: '', off: true });
        }
      })
      .catch(() => { if (alive) setAi({ loading: false, analisa: '', saran: '', off: true }); });
    return () => { alive = false; };
  }, [command, positions, range]);

  async function exportPng() {
    // wallet-health punya kartu share sendiri; perintah lain jatuh ke popup.
    const node = healthRef.current || cardRef.current;
    if (!node) return;
    setBusy(true);
    try {
      const { toPng } = await import('html-to-image');
      const url = await toPng(node, {
        pixelRatio: 2, backgroundColor: '#0b0e13', skipFonts: true,
        // kunci ukuran ke node aslinya — klon kadang salah mengukur
        width: node.offsetWidth, height: node.offsetHeight,
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
          <div className="tp-note">
            # skor heuristik internal, bukan standar industri.
            <br /># tidak dibandingkan dengan wallet LP lain.
          </div>
          <HealthCard
            innerRef={healthRef}
            health={h}
            positions={positions}
            range={range}
            walletLabel={walletLabel}
          />
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
            const cls = pnlCls(p.pnlSol);
            return (
              <div className="pair-row tp-row" key={p.positionAddress || i} onClick={() => onSelectPosition && onSelectPosition(p)}>
                <span className="lbl">{sinceStr(p.closedAt)} <span className="dim">· fee {m(p.feesSol, { compact: true, unit: false })}</span></span>
                <span className={cls}>{m(p.pnlSol, { compact: true, unit: false })} <span className="dim">{fmtPct(p.pnlPct)}</span></span>
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
            return (
              <div className="pair-row" key={o.pair} onClick={() => setDetailPair(o.pair)}>
                <div className="tp-row"><span><span className="dim">{i + 1}</span> <span className="cy">{o.pair}</span></span>
                  <span className={pnlCls(o.pnl)}>{m(o.pnl, { compact: true, unit: false })}</span></div>
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
        <div className="tp-row"><span className="lbl">price impact</span><span className={pnlCls(a.priceImpact)}>{m(a.priceImpact, { compact: true })}</span></div>
        <div className="tp-div" />
        <div className="tp-row"><span className="lbl">wallet growth</span><span className={pnlCls(a.growth)}>{m(a.growth, { compact: true })}</span></div>
        <div className="tp-row" style={{ alignItems: 'center', marginTop: 4 }}>
          <span className="lbl">audit</span>
          <span className={'tp-badge ' + (a.state > 0 ? 'gr' : a.state < 0 ? 'rd' : 'ev')}>{a.state > 0 ? 'pass ✓' : a.state < 0 ? 'review' : 'breakeven'}</span>
        </div>
        <div className="tp-ins" style={{ marginTop: 6 }}>{a.state < 0 ? '!' : '✓'} {a.note}</div>
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
              <span className={pnlCls(r.pnl)}>{m(r.pnl, { compact: true, unit: false })}</span>
            </div>
          ))}
          <div className="tp-div" />
          <div className="tp-row"><span className="br">combined</span><span className={pnlCls(c.combined)}>{m(c.combined, { compact: true })}</span></div>
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
          <div className="tp-sec">analysis {ai.analisa && <span className="tp-ai">ai</span>}</div>

          {ai.loading ? (
            <div className="tp-narr dim">menganalisa…</div>
          ) : ai.analisa ? (
            <div className="tp-narr">{ai.analisa}</div>
          ) : (
            <div className="tp-narr">
              Wallet menghasilkan <span className="gr">{m(s.totalFees, { compact: true })}</span> fee.{' '}
              <span className={s.ilRatio >= 0.5 ? 'rd' : 'br'}>{Math.round(s.ilRatio * 100)}%</span> tergerus IL.{' '}
              {s.bestPool && <>Pool terbaik <span className="cy">{s.bestPool.pair}</span>.{' '}</>}
              Rata-rata posisi <span className="br">{s.avgHoldMin} menit</span>.{' '}
              {s.longWorse ? 'Hold >2 jam performa lebih rendah.' : 'Durasi hold relatif konsisten.'}
            </div>
          )}

          <div className="tp-div" />
          <div className="tp-sec">suggestion</div>
          {ai.loading ? (
            <div className="tp-sugg dim">menganalisa…</div>
          ) : (
            <div className="tp-sugg">→ {ai.saran || s.suggestion}</div>
          )}

          {!ai.loading && ai.off && (
            <div className="tp-ins" style={{ marginTop: 8 }}>! rule-based — LLM tidak aktif</div>
          )}
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
