'use client';

import { useState } from 'react';
import { shortAddr } from '../lib/format';

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const MAX = 5;

function parseWallets(text) {
  return [...new Set(text.split(/[\s,]+/).map((w) => w.trim()).filter(Boolean))];
}

export default function Landing({ onAnalyze, loading, error, initial }) {
  const [text, setText] = useState(initial || '');
  const [touched, setTouched] = useState(false);

  const list = parseWallets(text);
  const valids = list.filter((w) => BASE58.test(w));
  const invalids = list.filter((w) => !BASE58.test(w));
  const tooMany = valids.length > MAX;
  const canSubmit = valids.length > 0 && invalids.length === 0 && !tooMany;

  const submit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (canSubmit && !loading) onAnalyze(valids.join(','));
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
            (posisi yang sudah closed). Bisa <span className="br">sampai {MAX} wallet sekaligus</span> —
            pisahkan dengan baris baru, spasi, atau koma; datanya digabung jadi satu view.
            Read-only, tanpa connect wallet.
          </p>

          <form onSubmit={submit} className="connect-form">
            <label className="dim flbl">$ dlmm stats --wallet (maks {MAX})</label>
            <textarea
              className={'winput wtext' + (touched && (invalids.length || tooMany) ? ' err' : '')}
              placeholder={'paste satu atau beberapa alamat wallet…\nsatu per baris'}
              value={text}
              rows={3}
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
              onChange={(e) => setText(e.target.value)}
              disabled={loading}
            />

            {list.length > 0 && (
              <div className="wchips">
                {list.map((w, i) => {
                  const ok = BASE58.test(w);
                  return (
                    <span key={w + i} className={'wchip ' + (ok ? 'ok' : 'bad')} title={w}>
                      {ok ? '✓' : '✗'} {shortAddr(w)}
                    </span>
                  );
                })}
              </div>
            )}
            {valids.length > 0 && (
              <div className={'wcount ' + (tooMany ? 'err-msg' : 'dim')}>
                {valids.length} wallet valid{tooMany ? ` · terlalu banyak, maks ${MAX}` : ''}
              </div>
            )}

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

          {touched && invalids.length > 0 && (
            <div className="msg err-msg">{invalids.length} alamat tidak valid (base58, 32–44 karakter)</div>
          )}
          {touched && tooMany && (
            <div className="msg err-msg">maksimal {MAX} wallet — kurangi dulu</div>
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
