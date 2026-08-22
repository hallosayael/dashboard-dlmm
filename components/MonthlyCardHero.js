'use client';

// Isi kartu PnL — versi "hero recap": pixel $ raksasa yang membelah keluar dari tepi
// kanan, tema terminal gelap. Otomatis merah + label "loss" saat total minus
// (fees & biggest win tetap hijau — fee tetap didapat, posisi terbaik tetap ada
// walau totalnya rugi). Rasio ~72:47 mengikuti sample acuan.
//
// CAKUPAN DATA: berbeda dengan gaya kalender (yang membaca per-HARI dalam satu bulan),
// kartu ini membaca SEMUA POSISI closed sampai sekarang (all-time, per-posisi).
// Jadi W/L/E-nya jumlah posisi, bukan jumlah hari.
//
// CATATAN PNG: pixel $ digambar sebagai <rect> langsung dengan atribut fill eksplisit
// (bukan <use href="#defs"> + currentColor). html-to-image memutus referensi <use>
// saat meng-clone node, sehingga currentColor jatuh ke warna teks kartu dan $ ikut
// jadi abu-putih di hasil download. Digambar langsung = warna dijamin ikut.

import { fmtMoney, fmtRoi, pnlState } from '../lib/format';

// Peta piksel karakter "$" pada grid 5 x 7.
const PIX_D = [
  [2, 0],
  [1, 1], [2, 1], [3, 1],
  [0, 2], [2, 2],
  [1, 3], [2, 3], [3, 3],
  [2, 4], [4, 4],
  [1, 5], [2, 5], [3, 5],
  [2, 6],
];

function PixelDollar({ fill, className, style }) {
  return (
    <svg viewBox="0 0 5 7" className={className} style={style} aria-hidden="true">
      {PIX_D.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="0.84" height="0.84" rx="0.1" fill={fill} />
      ))}
    </svg>
  );
}

export default function MonthlyCardHero({ cardRef, cur, solUsd, usdIdr, positions }) {
  const cval = (v, o) => fmtMoney(v, cur, solUsd, usdIdr, o);
  const compactBare = { compact: true, bare: true };
  const compactSym = cur === 'sol' ? compactBare : { compact: true };

  const all = positions || [];

  // Rekap all-time, dihitung PER POSISI (bukan per hari).
  let realized = 0, fees = 0, wins = 0, losses = 0, evens = 0, best = null;
  for (const p of all) {
    realized += p.pnlSol;
    fees += p.feesSol;
    const st = pnlState(p.pnlSol);
    if (st > 0) wins += 1; else if (st < 0) losses += 1; else evens += 1;
    if (!best || p.pnlSol > best.pnlSol) best = p;
  }

  // Win rate mengabaikan posisi impas — sama seperti panel summary di dashboard.
  const winRate = (wins + losses) ? Math.round((wins / (wins + losses)) * 100) : 0;
  const isLoss = realized < 0;

  const stateCls = isLoss ? 'mh-r' : 'mh-g';
  const pillBg = isLoss ? '#f85149' : '#3fb950';
  const pillFg = isLoss ? '#2b0808' : '#04150b';
  const pixColor = isLoss ? '#f85149' : '#3fb950';
  const pixGhost = isLoss ? '#3a1414' : '#123420';

  return (
    <div className="mh-card" ref={cardRef}>
      <PixelDollar fill={pixGhost} className="mh-pixghost" />

      <div className="mh-top">
        <span><span className="mh-g">meridian@dlmm</span><span className="mh-dim2">:~$</span> <span className="mh-cmd">dlmm-recap all</span></span>
        <span className="mh-dim">{all.length} posisi closed</span>
      </div>

      <div className="mh-mid">
        <div className="mh-left">
          <div className={'mh-plabel ' + stateCls}>{isLoss ? 'loss' : 'profit'} &middot; all time</div>
          <span className="mh-pill" style={{ background: pillBg, color: pillFg }}>{cval(realized, compactSym)}</span>
          <div className="mh-kv"><span className="mh-dim">realized</span> <b className={stateCls}>{cval(realized, compactSym)}</b></div>
          <div className="mh-kv"><span className="mh-dim">fees earned</span> <b className="mh-g">{cval(fees, compactSym)}</b></div>
          <div className="mh-kv">
            <span className="mh-dim">biggest win</span>{' '}
            <b className="mh-g">{best ? `${best.pair} ${cval(best.pnlSol, { compact: true, unit: false })} (${fmtRoi(best.pnlSol, best.pnlPct)})` : '—'}</b>
          </div>
          <div className="mh-kv">
            <span className="mh-dim">win rate</span> <b className="mh-num">{winRate}%</b>{' '}
            <span className="mh-dim2">({wins}W / {losses}L{evens ? ` / ${evens}E` : ''})</span>
          </div>
        </div>
        <PixelDollar fill={pixColor} className="mh-pix" />
      </div>

      <div className="mh-foot">
        <span className="mh-site">dashboard.dlmm.my.id</span>
        <span className="mh-dim2">{wins + losses + evens} closed &middot; {evens} impas</span>
      </div>
    </div>
  );
}
