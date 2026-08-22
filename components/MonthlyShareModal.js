'use client';

// Modal "share PnL bulanan" — pemilih 2 gaya kartu (kalender vs hero terminal $),
// geser kiri/kanan (swipe di HP, panah/klik dot di desktop) untuk membandingkan,
// lalu satu tombol download mengambil gaya yang sedang aktif sebagai PNG.

import { useEffect, useRef, useState } from 'react';
import MonthlyCard from './MonthlyCard';
import MonthlyCardHero from './MonthlyCardHero';

const STYLES = [
  { key: 'calendar', label: 'kalender', file: (iso) => `dlmm-month-${iso}.png`, width: 640 },
  { key: 'hero', label: 'terminal $', file: (iso) => `dlmm-recap-${iso}.png`, width: 640 },
];

export default function MonthlyShareModal({ positions, M, year, month, cur, solUsd, usdIdr, onClose }) {
  const [variant, setVariant] = useState(0);
  const [busy, setBusy] = useState(false);
  const calRef = useRef(null);
  const heroRef = useRef(null);
  const touchX = useRef(null);

  useEffect(() => {
    const h = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setVariant((v) => Math.max(0, v - 1));
      if (e.key === 'ArrowRight') setVariant((v) => Math.min(STYLES.length - 1, v + 1));
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const onTouchStart = (e) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) < 40) return;
    if (dx < 0) setVariant((v) => Math.min(STYLES.length - 1, v + 1));
    else setVariant((v) => Math.max(0, v - 1));
  };

  async function download() {
    const ref = variant === 0 ? calRef : heroRef;
    const node = ref.current;
    if (!node) return;
    setBusy(true);
    const prev = { width: node.style.width, maxWidth: node.style.maxWidth };
    try {
      const w = STYLES[variant].width;
      node.style.width = w + 'px';
      node.style.maxWidth = 'none';
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const { toPng } = await import('html-to-image');
      const url = await Promise.race([
        toPng(node, {
          pixelRatio: 2, width: node.offsetWidth, height: node.offsetHeight,
          backgroundColor: '#0b0e13', skipFonts: true,
        }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout 25s')), 25000)),
      ]);
      const iso = `${year}-${String(month + 1).padStart(2, '0')}`;
      const a = document.createElement('a');
      a.download = STYLES[variant].file(iso);
      a.href = url;
      a.click();
    } catch (err) {
      console.error('[monthly share download]', err);
      alert('gagal membuat gambar: ' + (err && err.message ? err.message : err) + '\n(coba screenshot manual)');
    } finally {
      node.style.width = prev.width;
      node.style.maxWidth = prev.maxWidth;
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="recap-wrap mo-wrap share-picker" onClick={(e) => e.stopPropagation()}>
        <div className="share-tabs">
          {STYLES.map((s, i) => (
            <button key={s.key} className={'share-tab' + (i === variant ? ' on' : '')} onClick={() => setVariant(i)}>
              {s.label}
            </button>
          ))}
        </div>

        <div className="share-stage">
          <button
            className="share-arrow share-arrow-l"
            onClick={() => setVariant((v) => Math.max(0, v - 1))}
            disabled={variant === 0}
            aria-label="gaya sebelumnya"
          >‹</button>

          <div className="share-track" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            <div className="share-slides" style={{ transform: `translateX(-${variant * 100}%)` }}>
              <div className="share-slide">
                <MonthlyCard cardRef={calRef} M={M} year={year} month={month} cur={cur} solUsd={solUsd} usdIdr={usdIdr} />
              </div>
              <div className="share-slide">
                <MonthlyCardHero cardRef={heroRef} M={M} year={year} month={month} cur={cur} solUsd={solUsd} usdIdr={usdIdr} positions={positions} />
              </div>
            </div>
          </div>

          <button
            className="share-arrow share-arrow-r"
            onClick={() => setVariant((v) => Math.min(STYLES.length - 1, v + 1))}
            disabled={variant === STYLES.length - 1}
            aria-label="gaya berikutnya"
          >›</button>
        </div>

        <div className="share-dots">
          {STYLES.map((s, i) => (
            <span key={s.key} className={'share-dot' + (i === variant ? ' on' : '')} onClick={() => setVariant(i)} />
          ))}
        </div>

        <div className="recap-actions">
          <button className="recap-dl" onClick={download} disabled={busy}>
            {busy ? 'membuat…' : `↓ download png · ${STYLES[variant].label}`}
          </button>
          <button className="recap-close" onClick={onClose}>tutup</button>
        </div>
      </div>
    </div>
  );
}
