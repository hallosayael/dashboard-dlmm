'use client';

import { useEffect, useRef, useState } from 'react';
import { fmtMoney, pnlState, pnlCls, MONTH_NAMES } from '../lib/format';

const HARI = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];

// DUA gaya wajah, dipilih per-perangkat:
//  - DESKTOP (pointer mouse): ASCII blok bulat — tampil bagus karena font monospace
//    desktop (Consolas) merender blok ▄▀█ dengan lebar konsisten.
//  - HP/TABLET (pointer sentuh): bentuk CSS — font HP merender blok ASCII tidak
//    konsisten (miring), jadi dipakai border+lengkung yang identik di semua perangkat.
const FACE_UP = [' ▄▀▀▀▀▀▄ ', '█ $   $ █', '█  ╰─╯  █', ' ▀▄▄▄▄▄▀ '];
const FACE_DOWN = [' ▄▀▀▀▀▀▄ ', '█ ╥   ╥ █', '█  ╭─╮  █', ' ▀▄▄▄▄▄▀ '];
const FACE_FLAT = [' ▄▀▀▀▀▀▄ ', '█ -   - █', '█  ───  █', ' ▀▄▄▄▄▄▀ '];

function faceAscii(state) {
  if (state > 0) return FACE_UP;
  if (state < 0) return FACE_DOWN;
  return FACE_FLAT;
}
function faceParts(state) {
  if (state > 0) return { eye: '$', mouth: 'dc-smile' };   // profit — mata duit, senyum
  if (state < 0) return { eye: 'T', mouth: 'dc-frown' };   // loss — sedih, cemberut
  return { eye: '-', mouth: 'dc-flat' };                    // impas — datar
}

export default function DailyCard({ positions, day, month, year, cur, solUsd, usdIdr, onClose }) {
  const cardRef = useRef(null);
  const [busy, setBusy] = useState(false);
  // perangkat sentuh (HP/tablet) → wajah CSS; mouse (PC) → wajah ASCII.
  // default false (ASCII) lalu dikoreksi setelah mount agar aman dari hydration.
  const [touch, setTouch] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      setTouch(window.matchMedia('(pointer: coarse)').matches);
    }
  }, []);

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const m = (sol, o) => fmtMoney(sol, cur, solUsd, usdIdr, o);

  // agregasi hari ini — sumbernya sama dengan tooltip kalender, jadi angkanya sinkron.
  const day_positions = [...positions].sort((a, b) => a.closedAt - b.closedAt);
  const pnl = day_positions.reduce((a, p) => a + (Number(p.pnlSol) || 0), 0);
  const fees = day_positions.reduce((a, p) => a + (Number(p.feesSol) || 0), 0);
  const c = day_positions.length;
  let w = 0, l = 0, e = 0;
  const blocks = day_positions.map((p) => {
    const s = pnlState(p.pnlSol);
    if (s > 0) { w++; return 'p'; }
    if (s < 0) { l++; return 'l'; }
    e++; return 'n';
  });
  const winRate = (w + l) ? Math.round((w / (w + l)) * 100) : 0;

  const state = pnlState(pnl);
  const face = faceAscii(state);          // dipakai di desktop
  const { eye, mouth } = faceParts(state); // dipakai di HP
  const cls = pnlCls(pnl);            // gr / rd / ev
  const faceCls = state > 0 ? 'gr' : state < 0 ? 'rd' : 'dc-dim';

  const wd = new Date(Date.UTC(year, month, day)).getUTCDay();
  const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const tanggalUpper = `${HARI[wd].toUpperCase()} · ${day} ${MONTH_NAMES[month].toUpperCase()} ${year}`;

  async function download() {
    if (!cardRef.current) return;
    setBusy(true);
    const node = cardRef.current;
    // simpan lebar asli, lalu paksa 620px saat capture supaya PNG selalu memakai
    // tata-letak desktop (tidak reflow jadi jelek di layar HP yang sempit).
    const prev = { width: node.style.width, maxWidth: node.style.maxWidth };
    try {
      node.style.width = '620px';
      node.style.maxWidth = 'none';
      // tunggu 2 frame supaya reflow ke lebar baru selesai sebelum difoto.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      const { toPng } = await import('html-to-image');
      const url = await Promise.race([
        toPng(node, {
          pixelRatio: 2,
          width: node.offsetWidth,
          height: node.offsetHeight,
          backgroundColor: '#0b0e13',
          skipFonts: true,
        }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout 25s')), 25000)),
      ]);
      const a = document.createElement('a');
      a.download = `dlmm-day-${iso}.png`;
      a.href = url;
      a.click();
    } catch (err) {
      console.error('[daily download]', err);
      alert('gagal membuat gambar: ' + (err && err.message ? err.message : err) + '\n(coba screenshot manual)');
    } finally {
      node.style.width = prev.width;
      node.style.maxWidth = prev.maxWidth;
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="recap-wrap" onClick={(ev) => ev.stopPropagation()}>
        <div className="dc-card" ref={cardRef}>
          <div className="dc-prompt">meridian@dlmm:~$ <span className="dc-cmd">dlmm-day {iso}</span></div>

          <div className="dc-body">
            {touch ? (
              <div className={'dc-facebox ' + faceCls}>
                <div className="dc-eyes2"><span>{eye}</span><span>{eye}</span></div>
                <div className={mouth} />
              </div>
            ) : (
              <pre className={'dc-face ' + faceCls}>{face.join('\n')}</pre>
            )}
            <div className="dc-info">
              <div className="dc-date">{tanggalUpper}</div>
              <div className="dc-hero">
                <span className={'dc-num ' + cls}>{m(pnl, { unit: false })}</span>
                <span className="dc-unit">SOL</span>
              </div>
              <div className="dc-grid">
                <div><span className="dc-k">fees</span><span className="gr">{m(fees, { unit: false })}</span></div>
                <div><span className="dc-k">win rate</span>{winRate}%</div>
                <div><span className="dc-k">posisi</span>{c} closed</div>
                <div><span className="dc-k">hasil</span><span className="gr">{w}W</span> · <span className="rd">{l}L</span> · <span className="dc-dim">{e}E</span></div>
              </div>
            </div>
          </div>

          <div className="dc-blocks">
            {blocks.map((b, i) => <span className={'dc-blk ' + b} key={i} />)}
          </div>

          <div className="dc-foot">
            <span className="dc-site">dashboard.dlmm.my.id</span>
            <span className="dc-dim">tiap blok = 1 posisi</span>
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
