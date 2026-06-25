'use client';

import { useState } from 'react';

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export default function Landing({ onAnalyze, loading, error, initial }) {
  const [addr, setAddr] = useState(initial || '');
  const [touched, setTouched] = useState(false);

  const valid = BASE58.test(addr.trim());

  const submit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (valid && !loading) onAnalyze(addr.trim());
  };

  return (
    <div className="wrap landing-wrap">
      <div className="term">
        <div className="bar">
          <span className="dot" style={{ background: '#f85149' }} />
          <span className="dot" style={{ background: '#d29922' }} />
          <span className="dot" style={{ background: '#3fb950' }} />
          <span className="ttl">meridian@dlmm: ~/connect</span>
        </div>
        <div className="body">
          <div className="brandline">
            <span className="gr">dlmm</span>
            <span className="dim"> · closed positions explorer</span>
          </div>
          <p className="lead dim">
            Tempel alamat wallet Solana untuk melihat hasil trading DLMM-mu
            (posisi yang sudah closed). Data dibaca dari portfolio API Meteora —
            PnL ditampilkan dalam SOL. Read-only, tanpa connect wallet.
          </p>

          <form onSubmit={submit} className="connect-form">
            <label className="dim flbl">$ dlmm stats --wallet</label>
            <input
              className={'winput' + (touched && !valid ? ' err' : '')}
              placeholder="paste alamat wallet di sini…"
              value={addr}
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
              onChange={(e) => setAddr(e.target.value)}
              disabled={loading}
            />
            <div className="actions">
              <button type="submit" className="btn primary" disabled={loading}>
                {loading ? 'membaca…' : 'analyze ↵'}
              </button>
              <button
                type="button"
                className="btn"
                disabled={loading}
                onClick={() => onAnalyze('demo')}
              >
                lihat demo
              </button>
            </div>
          </form>

          {touched && !valid && addr.trim() !== '' && (
            <div className="msg err-msg">alamat tidak valid (base58, 32–44 karakter)</div>
          )}
          {error && <div className="msg err-msg">{error}</div>}

          <div className="hintbar dim">
            read-only · cukup public key · tidak perlu connect / tanda tangan
          </div>
        </div>
      </div>

      <div className="foot dim">
        data: meteora portfolio api · harga sol: jupiter · hari GMT+7
      </div>
    </div>
  );
}
