'use client';

// Halaman widget self-contained untuk dipasang lewat app "web widget" di HP.
// Contoh: https://dashboard.dlmm.my.id/widget?wallet=XXX&denom=idr&range=30d
// Merender kartu (maskot + net PnL + sparkline data asli + chip) & auto-refresh.

import { useEffect, useState } from 'react';
import { pnlState } from '../../lib/format';

const REFRESH_MS = 5 * 60 * 1000;
const C = { gr: '#3fb950', rd: '#f85149', ev: '#9aa4b0' };

export default function WidgetPage() {
  const [d, setD] = useState(null);
  const [wallet, setWallet] = useState('');
  const [err, setErr] = useState(null);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const w = sp.get('wallet') || '';
    const denom = sp.get('denom') || 'sol';
    const range = sp.get('range') || '30d';
    setWallet(w);
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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8, boxSizing: 'border-box' }}>
      <a href={wallet ? `/?wallet=${encodeURIComponent(wallet)}` : '/'} style={{ textDecoration: 'none', width: '100%', maxWidth: 420 }}>
        <div style={{ background: '#0e1319', border: '1px solid #222a33', borderRadius: 22, padding: '15px 16px 14px', position: 'relative', overflow: 'hidden', fontFamily: 'ui-sans-serif,system-ui,Roboto,sans-serif' }}>
          <div aria-hidden style={{ position: 'absolute', top: -24, right: -18, width: 90, height: 90, borderRadius: '50%', background: '#12312433' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 9, position: 'relative' }}>
            <Mascot color={state < 0 ? C.rd : C.gr} />
            <div style={{ lineHeight: 1.25 }}>
              <div style={{ fontFamily: 'ui-monospace,Menlo,Consolas,monospace', fontSize: 12.5, color: '#e6edf3' }}>
                dlmm<span style={{ color: '#8b949e' }}> · {d ? d.label : '…'}</span>
              </div>
              <div style={{ fontSize: 11, color: '#6e7681' }}>cuan {d ? d.range : '30d'}</div>
            </div>
            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: C.gr, background: '#10241a', border: '1px solid #245d33', padding: '2px 8px', borderRadius: 20 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.gr, display: 'inline-block' }} />live
            </span>
          </div>

          {err ? (
            <div style={{ color: '#8b949e', fontSize: 12, padding: '18px 2px', fontFamily: 'ui-monospace,monospace' }}>! {err}</div>
          ) : (
            <>
              <div style={{ fontFamily: 'ui-monospace,Menlo,Consolas,monospace', fontSize: 33, fontWeight: 600, color: netColor, letterSpacing: '.5px', margin: '12px 0 2px' }}>
                {d ? d.net : '…'}
              </div>

              <Spark data={d?.spark} color={netColor} />

              <div style={{ display: 'flex', gap: 8 }}>
                <Chip label="hari ini" value={d ? d.today : '…'} color={d ? (pnlState(d.todaySol) > 0 ? C.gr : pnlState(d.todaySol) < 0 ? C.rd : C.ev) : '#9aa4b0'} />
                <Chip label="win rate" value={d ? d.winrate : '…'} color="#e6edf3" />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 11, fontSize: 10, color: '#6e7681', fontFamily: 'ui-monospace,Menlo,Consolas,monospace' }}>
                <span>↻ update {d ? d.updated : '—'}</span>
                <span style={{ color: '#a99cf5' }}>tap → dashboard</span>
              </div>
            </>
          )}
        </div>
      </a>
    </div>
  );
}

function Chip({ label, value, color }) {
  return (
    <div style={{ flex: 1, background: '#0b0e13', border: '1px solid #1b2128', borderRadius: 12, padding: '7px 10px' }}>
      <div style={{ fontSize: 10, color: '#6e7681' }}>{label}</div>
      <div style={{ fontFamily: 'ui-monospace,Menlo,Consolas,monospace', fontSize: 13, color }}>{value}</div>
    </div>
  );
}

function Spark({ data, color }) {
  if (!data || data.length < 2) return <div style={{ height: 38, margin: '4px 0 12px' }} />;
  const W = 260, H = 44, pad = 5;
  const min = Math.min(0, ...data), max = Math.max(0, ...data);
  const span = (max - min) || 1;
  const x = (i) => pad + (i / (data.length - 1)) * (W - pad * 2);
  const y = (v) => pad + (1 - (v - min) / span) * (H - pad * 2);
  const pts = data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const li = data.length - 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 38, display: 'block', margin: '4px 0 12px' }} aria-hidden>
      <line x1="0" y1={y(0)} x2={W} y2={y(0)} stroke="#222a33" strokeWidth="1" strokeDasharray="3 4" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(li)} cy={y(data[li])} r="3.6" fill={color} stroke="#0e1319" strokeWidth="2" />
    </svg>
  );
}

function Mascot({ color }) {
  return (
    <svg width="34" height="34" viewBox="0 0 40 40" aria-hidden>
      <path d="M20 5 C20 1 25 1 24 6" stroke={color} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <ellipse cx="27" cy="4.5" rx="3.6" ry="2.3" transform="rotate(28 27 4.5)" fill={color} />
      <rect x="6" y="9" width="28" height="27" rx="13" fill={color} />
      <circle cx="15" cy="21" r="4.2" fill="#fff" /><circle cx="25" cy="21" r="4.2" fill="#fff" />
      <circle cx="16" cy="22" r="2" fill="#0b0e13" /><circle cx="26" cy="22" r="2" fill="#0b0e13" />
      <path d="M16 29 Q20 32 24 29" stroke="#0b3d20" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}
