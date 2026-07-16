'use client';

// Halaman widget self-contained untuk dipasang lewat app "web widget" / app native
// yang men-screenshot halaman ini. Satu URL = satu tampilan, dipilih via ?layout= :
//   mascot (default), ticker (2x2), face (2x2), statusline (4x2), glance (4x4)
// Contoh: /widget?wallet=XXX&denom=idr&range=30d&layout=ticker
//
// Semua layout MENGISI PENUH viewport (= ukuran widget), tanpa sisi kosong.
// Ukuran font/elemen pakai `vmin` supaya ikut skala ukuran widget. Wajah pakai
// BENTUK CSS (bukan ASCII) karena render di WebView HP.

import { useEffect, useState } from 'react';
import { pnlState } from '../../lib/format';

const REFRESH_MS = 5 * 60 * 1000;
const C = {
  gr: '#3fb950', rd: '#f85149', ev: '#9aa4b0',
  dim: '#6e7681', dd: '#4d5560', bg: '#0e1319', card: '#0b0e13', bd: '#1b2128',
  pp: '#a99cf5', text: '#e6edf3',
  mono: 'ui-monospace,Menlo,Consolas,monospace',
};

const LAYOUTS = new Set(['mascot', 'ticker', 'face', 'statusline', 'glance']);

export default function WidgetPage() {
  const [d, setD] = useState(null);
  const [wallet, setWallet] = useState('');
  const [layout, setLayout] = useState('mascot');
  const [err, setErr] = useState(null);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const w = sp.get('wallet') || '';
    const denom = sp.get('denom') || 'sol';
    const range = sp.get('range') || '30d';
    const lay = (sp.get('layout') || 'mascot').toLowerCase();
    setWallet(w);
    setLayout(LAYOUTS.has(lay) ? lay : 'mascot');
    if (!w) { setErr('tambahkan ?wallet=ALAMAT di URL'); return; }

    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(`/api/widget?wallet=${encodeURIComponent(w)}&denom=${denom}&range=${range}`);
        const j = await r.json();
        if (!alive) return;
        if (j.error) setErr(j.error);
        else { setD(j); setErr(null); }
      } catch {
        if (alive) setErr('gagal memuat');
      }
    };
    load();
    const iv = setInterval(load, REFRESH_MS);
    const onVis = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { alive = false; clearInterval(iv); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  const state = d ? pnlState(d.netSol) : 0;
  const netColor = state > 0 ? C.gr : state < 0 ? C.rd : C.ev;
  const href = wallet ? `/?wallet=${encodeURIComponent(wallet)}` : '/';

  let body;
  if (layout === 'ticker') body = <Ticker d={d} err={err} netColor={netColor} />;
  else if (layout === 'face') body = <FaceCard d={d} err={err} />;
  else if (layout === 'statusline') body = <Statusline d={d} err={err} netColor={netColor} />;
  else if (layout === 'glance') body = <Glance d={d} err={err} netColor={netColor} />;
  else body = <Mascot d={d} err={err} state={state} netColor={netColor} />;

  // Root & link mengisi penuh (100vw x 100vh); kartu di dalamnya juga fill.
  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, display: 'flex', boxSizing: 'border-box' }}>
      <a href={href} style={{ textDecoration: 'none', width: '100%', height: '100%', display: 'block' }}>
        {body}
      </a>
    </div>
  );
}

/* ---------- helper ---------- */

// Kartu yang MENGISI PENUH viewport. padding pakai vmin → aman di tiap ukuran.
function fillCard(extra) {
  return {
    background: C.bg, boxSizing: 'border-box', fontFamily: 'ui-sans-serif,system-ui,Roboto,sans-serif',
    width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden',
    ...extra,
  };
}

function ErrBox({ err }) {
  return <div style={{ color: '#8b949e', fontSize: '4vmin', fontFamily: C.mono, margin: 'auto', padding: '6vmin', textAlign: 'center' }}>! {err}</div>;
}

function dayColor(v, maxAbs) {
  const s = pnlState(v);
  if (s === 0) return '#2f3742';
  const r = maxAbs > 0 ? Math.abs(v) / maxAbs : 0;
  if (s > 0) return r > 0.66 ? '#3fb950' : r > 0.33 ? '#1e5a37' : '#143d27';
  return r > 0.66 ? '#8b1f1f' : r > 0.33 ? '#5a1f1f' : '#3a1718';
}

// Heatmap yang meregang penuh selebar area (kotak auto-lebar via 1fr).
function Heatmap({ days, cols = 7, gap = '1.4vmin', h = '6vmin' }) {
  const arr = days || [];
  const maxAbs = arr.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap, width: '100%' }}>
      {arr.map((v, i) => (
        <div key={i} style={{ height: h, borderRadius: '1vmin', background: dayColor(v, maxAbs) }} />
      ))}
    </div>
  );
}

// Wajah reaktif — border + lengkung CSS. size = CSS length (mis. '34vmin').
function Face({ state, size }) {
  const col = state > 0 ? C.gr : state < 0 ? C.rd : C.ev;
  const eye = state > 0 ? '$' : state < 0 ? 'T' : '-';
  const b = `calc(${size} * 0.1)`;
  const mw = `calc(${size} * 0.34)`;
  const mh = `calc(${size} * 0.17)`;
  const bmo = `calc(${size} * 0.09)`;
  return (
    <div style={{ width: size, height: `calc(${size} * 0.9)`, border: `${b} solid ${col}`, borderRadius: '42%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: `calc(${size} * 0.12)`, color: col, boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', flexWrap: 'nowrap', gap: `calc(${size} * 0.18)`, fontSize: `calc(${size} * 0.3)`, fontWeight: 600, fontFamily: C.mono, lineHeight: 1 }}>
        <span>{eye}</span><span>{eye}</span>
      </div>
      {state > 0 ? (
        <div style={{ width: mw, height: mh, borderBottom: `${bmo} solid ${col}`, borderRadius: `0 0 ${size} ${size}`, boxSizing: 'border-box' }} />
      ) : state < 0 ? (
        <div style={{ width: mw, height: mh, borderTop: `${bmo} solid ${col}`, borderRadius: `${size} ${size} 0 0`, boxSizing: 'border-box' }} />
      ) : (
        <div style={{ width: `calc(${size} * 0.3)`, borderBottom: `${bmo} solid ${col}`, borderRadius: '1vmin' }} />
      )}
    </div>
  );
}

function LivePill() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '1.4vmin', fontSize: '3vmin', color: C.gr, background: '#10241a', border: '0.4vmin solid #245d33', padding: '0.6vmin 2.2vmin', borderRadius: '20vmin' }}>
      <span style={{ width: '1.7vmin', height: '1.7vmin', borderRadius: '50%', background: C.gr, display: 'inline-block' }} />live
    </span>
  );
}

/* ---------- mascot (lama) ---------- */

function Mascot({ d, err, state, netColor }) {
  return (
    <div style={fillCard({ padding: '4.5vmin 5vmin', justifyContent: 'space-between', position: 'relative' })}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '2.4vmin' }}>
        <MascotSvg color={state < 0 ? C.rd : C.gr} />
        <div style={{ lineHeight: 1.25 }}>
          <div style={{ fontFamily: C.mono, fontSize: '3.6vmin', color: C.text }}>dlmm<span style={{ color: '#8b949e' }}> · {d ? d.label : '…'}</span></div>
          <div style={{ fontSize: '3vmin', color: C.dim }}>cuan {d ? d.range : '30d'}</div>
        </div>
        <span style={{ marginLeft: 'auto' }}><LivePill /></span>
      </div>
      {err ? <ErrBox err={err} /> : (
        <>
          <div style={{ fontFamily: C.mono, fontSize: '9.5vmin', fontWeight: 600, color: netColor, letterSpacing: '.5px' }}>{d ? d.net : '…'}</div>
          <Spark data={d?.spark} color={netColor} />
          <div style={{ display: 'flex', gap: '2.4vmin' }}>
            <Chip label="hari ini" value={d ? d.today : '…'} color={d ? (pnlState(d.todaySol) > 0 ? C.gr : pnlState(d.todaySol) < 0 ? C.rd : C.ev) : C.ev} />
            <Chip label="win rate" value={d ? d.winrate : '…'} color={C.text} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '2.8vmin', color: C.dim, fontFamily: C.mono }}>
            <span>↻ {d ? d.updated : '—'}</span>
            <span style={{ color: C.pp }}>tap → dashboard</span>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- ticker (2x2) ---------- */

function Ticker({ d, err, netColor }) {
  const days7 = d?.days30 ? d.days30.slice(-7) : [];
  return (
    <div style={fillCard({ padding: '5vmin 5.5vmin', justifyContent: 'space-between' })}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: C.mono, fontSize: '4vmin', color: C.gr }}>dlmm</span>
        <span style={{ fontFamily: C.mono, fontSize: '3.4vmin', color: C.dd }}>{d ? d.range : '30d'}</span>
      </div>
      {err ? <ErrBox err={err} /> : (
        <>
          <div>
            <div style={{ fontFamily: C.mono, fontSize: '3.4vmin', color: C.dd }}>net pnl</div>
            <div style={{ fontFamily: C.mono, fontSize: '11vmin', fontWeight: 600, color: netColor, lineHeight: 1.05 }}>{d ? d.netBare : '…'}</div>
            <div style={{ fontFamily: C.mono, fontSize: '3.4vmin', color: C.dd }}>{d ? d.denom.toUpperCase() : 'SOL'} · <span style={{ color: C.dim }}>{d ? d.winrate : '…'} win</span></div>
          </div>
          <Heatmap days={days7} cols={7} gap="1.6vmin" h="7vmin" />
        </>
      )}
    </div>
  );
}

/* ---------- face (2x2) ---------- */

function FaceCard({ d, err }) {
  const ts = d ? pnlState(d.todaySol) : 0;
  const today = new Date();
  const dd = today.getDate();
  const bulan = ['jan', 'feb', 'mar', 'apr', 'mei', 'jun', 'jul', 'agu', 'sep', 'okt', 'nov', 'des'][today.getMonth()];
  const col = ts > 0 ? C.gr : ts < 0 ? C.rd : C.ev;
  return (
    <div style={fillCard({ padding: '5vmin', alignItems: 'center', justifyContent: 'center', gap: '3.5vmin' })}>
      {err ? <ErrBox err={err} /> : (
        <>
          <Face state={ts} size="40vmin" />
          <div style={{ fontFamily: C.mono, fontSize: '9vmin', fontWeight: 600, color: col, lineHeight: 1 }}>{d ? d.today : '…'}</div>
          <div style={{ fontFamily: C.mono, fontSize: '3.4vmin', color: C.dd }}>hari ini · {dd} {bulan}</div>
        </>
      )}
    </div>
  );
}

/* ---------- statusline (4x2) ---------- */

function Stat({ label, value, color, big }) {
  return (
    <div>
      <div style={{ fontFamily: C.mono, fontSize: '3.6vmin', color: C.dd }}>{label}</div>
      <div style={{ fontFamily: C.mono, fontSize: big ? '6.5vmin' : '6vmin', color: color || C.text, lineHeight: 1.2 }}>{value}</div>
    </div>
  );
}

function healthColor(d) {
  if (!d || d.health == null) return C.text;
  return d.health >= 60 ? C.gr : d.health >= 40 ? '#d29922' : C.rd;
}

function Statusline({ d, err, netColor }) {
  return (
    <div style={fillCard({ padding: '5vmin 6vmin', justifyContent: 'space-between' })}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: C.mono, fontSize: '3.8vmin', color: C.gr }}>meridian@dlmm:~$ <span style={{ color: C.text }}>stats {d ? d.range : '30d'}</span></span>
        <LivePill />
      </div>
      {err ? <ErrBox err={err} /> : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <Stat label="net" value={d ? d.netBare : '…'} color={netColor} big />
          <Stat label="win" value={d ? d.winrate : '…'} />
          <Stat label="fees" value={d ? d.feesBare : '…'} color={C.gr} />
          <Stat label="health" value={d && d.health != null ? d.health : '—'} color={healthColor(d)} />
        </div>
      )}
    </div>
  );
}

/* ---------- glance (4x4) ---------- */

function Glance({ d, err, netColor }) {
  return (
    <div style={fillCard({ padding: '5.5vmin 6vmin', justifyContent: 'space-between' })}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: C.mono, fontSize: '3.6vmin', color: C.gr }}>meridian@dlmm:~$ <span style={{ color: C.text }}>stats</span></span>
        <span style={{ fontFamily: C.mono, fontSize: '3vmin', color: C.dd }}>↻ {d ? d.updated : '—'}</span>
      </div>
      {err ? <ErrBox err={err} /> : (
        <>
          <div>
            <div style={{ fontFamily: C.mono, fontSize: '3.4vmin', color: C.dd }}>net pnl · {d ? d.range : '30d'}</div>
            <div style={{ fontFamily: C.mono, fontSize: '11vmin', fontWeight: 600, color: netColor, lineHeight: 1.05 }}>{d ? d.net : '…'}</div>
          </div>
          <Spark data={d?.spark} color={netColor} tall />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: `0.3vmin solid ${C.bd}`, paddingTop: '3vmin' }}>
            <Stat label="win" value={d ? d.winrate : '…'} />
            <Stat label="fees" value={d ? d.feesBare : '…'} color={C.gr} />
            <Stat label="health" value={d && d.health != null ? d.health : '—'} color={healthColor(d)} />
            <Stat label="closed" value={d ? d.count : '…'} />
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- sub-komponen bersama ---------- */

function Chip({ label, value, color }) {
  return (
    <div style={{ flex: 1, background: C.card, border: `0.3vmin solid ${C.bd}`, borderRadius: '3vmin', padding: '2vmin 2.6vmin' }}>
      <div style={{ fontSize: '2.8vmin', color: C.dim, fontFamily: C.mono }}>{label}</div>
      <div style={{ fontFamily: C.mono, fontSize: '3.6vmin', color }}>{value}</div>
    </div>
  );
}

function Spark({ data, color, tall }) {
  const h = tall ? '20vmin' : '11vmin';
  if (!data || data.length < 2) return <div style={{ height: h }} />;
  const W = 300, H = 60, pad = 4;
  const min = Math.min(0, ...data), max = Math.max(0, ...data);
  const span = (max - min) || 1;
  const x = (i) => pad + (i / (data.length - 1)) * (W - pad * 2);
  const y = (v) => pad + (1 - (v - min) / span) * (H - pad * 2);
  const pts = data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const li = data.length - 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: h, display: 'block' }} aria-hidden>
      <line x1="0" y1={y(0)} x2={W} y2={y(0)} stroke="#222a33" strokeWidth="1" strokeDasharray="3 4" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={x(li)} cy={y(data[li])} r="3" fill={color} />
    </svg>
  );
}

function MascotSvg({ color }) {
  return (
    <svg viewBox="0 0 40 40" style={{ width: '8vmin', height: '8vmin', flex: '0 0 auto' }} aria-hidden>
      <path d="M20 5 C20 1 25 1 24 6" stroke={color} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <ellipse cx="27" cy="4.5" rx="3.6" ry="2.3" transform="rotate(28 27 4.5)" fill={color} />
      <rect x="6" y="9" width="28" height="27" rx="13" fill={color} />
      <circle cx="15" cy="21" r="4.2" fill="#fff" /><circle cx="25" cy="21" r="4.2" fill="#fff" />
      <circle cx="16" cy="22" r="2" fill="#0b0e13" /><circle cx="26" cy="22" r="2" fill="#0b0e13" />
      <path d="M16 29 Q20 32 24 29" stroke="#0b3d20" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}
