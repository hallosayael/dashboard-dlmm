'use client';

import { useMemo } from 'react';
import { fmtMoney } from '../lib/format';

// Equity curve: PnL kumulatif (running total) dari posisi closed, urut waktu.
// Per-posisi (tiap posisi closed = 1 titik). Hijau saat kumulatif di atas 0,
// merah saat di bawah 0. Segmen yang menyeberang nol dipecah di titik potong.
export default function Chart({ positions, cur, solUsd, usdIdr }) {
  const pts = useMemo(() => {
    const s = [...positions].sort((a, b) => a.closedAt - b.closedAt);
    const arr = [];
    if (s.length) arr.push({ t: s[0].closedAt - 1, v: 0 });
    let cum = 0;
    for (const p of s) {
      cum += p.pnlSol;
      arr.push({ t: p.closedAt, v: cum });
    }
    return arr;
  }, [positions]);

  if (pts.length < 2) {
    return (
      <div className="dim" style={{ fontSize: 11, padding: '26px 0', textAlign: 'center' }}>
        belum cukup data untuk chart pada rentang ini
      </div>
    );
  }

  const W = 620, H = 104, padT = 12, padB = 4;
  const ts = pts.map((p) => p.t);
  const vs = pts.map((p) => p.v);
  const tmin = Math.min(...ts), tmax = Math.max(...ts);
  let vmin = Math.min(0, ...vs), vmax = Math.max(0, ...vs);
  if (vmax === vmin) { vmax += 0.001; vmin -= 0.001; }

  const x = (t) => (tmax === tmin ? W / 2 : ((t - tmin) / (tmax - tmin)) * W);
  const y = (v) => padT + ((vmax - v) / (vmax - vmin)) * (H - padT - padB);
  const y0 = y(0);

  const GREEN = '#3fb950', RED = '#f85149';
  const GREEN_FILL = '#143426', RED_FILL = '#3d1418';

  // Warna ditentukan oleh posisi relatif terhadap nol (bukan naik/turun).
  // Segmen yang menyeberang nol dipecah jadi dua sub-segmen di titik potong.
  const segs = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    if ((a.v >= 0) === (b.v >= 0) || a.v === b.v) {
      segs.push({
        x1: x(a.t), y1: y(a.v), x2: x(b.t), y2: y(b.v),
        pos: (a.v >= 0 && b.v >= 0),
      });
    } else {
      const f = a.v / (a.v - b.v); // fraksi sepanjang segmen di mana v = 0
      const xc = x(a.t) + f * (x(b.t) - x(a.t));
      segs.push({ x1: x(a.t), y1: y(a.v), x2: xc, y2: y0, pos: a.v >= 0 });
      segs.push({ x1: xc, y1: y0, x2: x(b.t), y2: y(b.v), pos: b.v >= 0 });
    }
  }

  const last = pts[pts.length - 1].v;
  const fmt = (v, o) => fmtMoney(v, cur, solUsd, usdIdr, o);

  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label="equity curve">
        <line x1="0" y1={y0} x2={W} y2={y0} stroke="#2a3038" strokeWidth="1" strokeDasharray="3 4" />
        {segs.map((sg, i) => (
          <polygon key={`a${i}`}
            points={`${sg.x1},${sg.y1} ${sg.x2},${sg.y2} ${sg.x2},${y0} ${sg.x1},${y0}`}
            fill={sg.pos ? GREEN_FILL : RED_FILL} opacity="0.35" />
        ))}
        {segs.map((sg, i) => (
          <line key={i} x1={sg.x1} y1={sg.y1} x2={sg.x2} y2={sg.y2}
            stroke={sg.pos ? GREEN : RED} strokeWidth="2" strokeLinejoin="round" />
        ))}
        <text x="3" y="11" fontSize="9" fill="#6e7681">{fmt(vmax, { compact: true })}</text>
        <text x="3" y={y0 - 3} fontSize="9" fill="#6e7681">{cur === 'sol' ? '0 SOL' : '0'}</text>
      </svg>
      <div className="dim" style={{ fontSize: 10, marginTop: 7 }}>
        kumulatif realized pnl · hijau di atas 0 / merah di bawah 0 · {fmt(last, {})}
      </div>
    </>
  );
}
