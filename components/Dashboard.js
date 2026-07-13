'use client';

import { useMemo, useState } from 'react';
import Calendar from './Calendar';
import Chart from './Chart';
import PositionModal from './PositionModal';
import RecapCard from './RecapCard';
import AnalyzeModal from './AnalyzeModal';
import { fmtMoney, fmtRoi, shortAddr, sinceStr, pnlState } from '../lib/format';

const PAGE_SIZE = 15;
const RANGE_DAYS = { '7d': 7, '30d': 30, all: Infinity };
const ANALYZE_CMDS = ['wallet-health', 'pool-analysis', 'audit', 'compare', 'insight'];

function Seg({ value, options, onChange }) {
  return (
    <span className="seg">
      {options.map((o) => (
        <span key={o} className={value === o ? 'on' : ''} onClick={() => onChange(o)}>{o}</span>
      ))}
    </span>
  );
}

export default function Dashboard({ wallet, data, onReset }) {
  const positions = data.positions || [];
  const solUsd = data.solPrice;
  const usdIdr = data.usdIdr;
  const wallets = data.wallets || (wallet ? [wallet] : []);
  const multi = wallets.length > 1;
  const walletLabel = data.demo ? 'demo' : (multi ? wallets.length + ' wallets' : shortAddr(wallets[0] || wallet));

  const [cur, setCur] = useState('sol');
  const [range, setRange] = useState('30d');
  const [view, setView] = useState('chart');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [showRecap, setShowRecap] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tool, setTool] = useState(null);

  const m = (sol, o) => fmtMoney(sol, cur, solUsd, usdIdr, o);

  const ranged = useMemo(() => {
    if (range === 'all') return positions;
    const cutoff = Date.now() / 1000 - RANGE_DAYS[range] * 86400;
    return positions.filter((p) => p.closedAt >= cutoff);
  }, [positions, range]);

  const s = useMemo(() => {
    const n = ranged.length;
    const totalPnl = ranged.reduce((a, p) => a + p.pnlSol, 0);
    const totalFees = ranged.reduce((a, p) => a + p.feesSol, 0);
    const priceIl = totalPnl - totalFees;
    const wins = ranged.filter((p) => pnlState(p.pnlSol) > 0).length;
    const losses = ranged.filter((p) => pnlState(p.pnlSol) < 0).length;
    const evens = n - wins - losses;
    const winRate = (wins + losses) ? (wins / (wins + losses)) * 100 : 0;
    let best = null, worst = null;
    for (const p of ranged) {
      if (!best || p.pnlSol > best.pnlSol) best = p;
      if (!worst || p.pnlSol < worst.pnlSol) worst = p;
    }
    const bdMax = Math.max(Math.abs(totalFees), Math.abs(priceIl), Math.abs(totalPnl)) || 1;
    return { n, totalPnl, totalFees, priceIl, wins, losses, evens, winRate, best, worst, bdMax };
  }, [ranged]);

  const perWallet = useMemo(() => {
    if (!multi) return [];
    const map = new Map(wallets.map((w) => [w, { wallet: w, pnl: 0, n: 0 }]));
    for (const p of ranged) {
      const o = map.get(p.owner);
      if (!o) continue;
      o.pnl += p.pnlSol; o.n += 1;
    }
    return [...map.values()].sort((a, b) => b.pnl - a.pnl);
  }, [ranged, wallets, multi]);

  const pnlCls = s.totalPnl >= 0 ? 'gr' : 'rd';

  const totalPages = Math.max(1, Math.ceil(positions.length / PAGE_SIZE));
  const curPage = Math.min(page, totalPages);
  const pageItems = positions.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);

  return (
    <div className="wrap">
      <div className="term">
        <div className="bar">
          <span className="dot" style={{ background: '#f85149' }} />
          <span className="dot" style={{ background: '#d29922' }} />
          <span className="dot" style={{ background: '#3fb950' }} />
          <span className="ttl">meridian@dlmm: ~/closed-positions</span>
          <button className="changebtn" onClick={onReset}>ganti wallet ↺</button>
        </div>

        <div className="body">
          <div className="promptline">
            <span className="gr">meridian@dlmm</span><span className="dim">:</span>
            <span className="cy">~/closed</span><span className="dim">$ </span>
            dlmm stats <span className="am">--wallet</span> {walletLabel}{' '}
            <span className="am">--closed</span> <span className="am">--denom</span> {cur}{' '}
            <span className="am">--range</span> {range}<span className="termcur" />
          </div>

          {data.demo && (
            <div className="demo-banner">mode demo · data contoh — tempel wallet asli untuk data sungguhan</div>
          )}

          {positions.length === 0 ? (
            <div className="panel empty-state">
              <div className="plabel">─ closed positions</div>
              <p className="dim">Tidak ada posisi DLMM closed untuk wallet ini.</p>
            </div>
          ) : (
            <>
              <div className="statusline">
                <span className="ctl"><span className="clbl">denom</span><Seg value={cur} options={['sol', 'usd', 'idr']} onChange={setCur} /></span>
                <span className="ctl"><span className="clbl">range</span><Seg value={range} options={['7d', '30d', 'all']} onChange={setRange} /></span>
                <span className="sl-actions">
                  <button className="sharebtn" onClick={() => setShowRecap(true)}>↗ share</button>
                  <span className="analyze-wrap">
                    <button className="analyzebtn" onClick={() => setMenuOpen((o) => !o)} aria-expanded={menuOpen}>analyze ▾</button>
                    {menuOpen && (
                      <>
                        <div className="menu-catch" onClick={() => setMenuOpen(false)} />
                        <div className="analyze-menu">
                          <div className="mlbl">analyze</div>
                          {ANALYZE_CMDS.map((c) => (
                            <button key={c} className="mitem" onClick={() => { setTool(c); setMenuOpen(false); }}>[ {c} ]</button>
                          ))}
                        </div>
                      </>
                    )}
                  </span>
                </span>
              </div>

              <div className="row2">
                <div className="panel">
                  <div className="plabel">─ summary · {range} · {s.n} closed</div>
                  <Row label="net pnl" value={<span className={pnlCls}>{m(s.totalPnl, {})}</span>} />
                  <Row label="fees earned" value={<span className="gr">{m(s.totalFees, {})}</span>} />
                  <Row label="win rate" value={<span className="br">{Math.round(s.winRate)}% <span className="dim">({s.wins}W / {s.losses}L{s.evens ? ` / ${s.evens}E` : ''})</span></span>} />
                  {s.best && <Row label="best" value={<span className="gr">{s.best.pair} {m(s.best.pnlSol, { compact: true })}</span>} />}
                  {s.worst && <Row label="worst" value={<span className="rd">{s.worst.pair} {m(s.worst.pnlSol, { compact: true })}</span>} />}
                </div>

                <div className="panel">
                  <div className="plabel">─ pnl breakdown · {range}</div>
                  <BdRow label="fees" cls="gr" w={(Math.abs(s.totalFees) / s.bdMax) * 100} bg="#3fb950" val={m(s.totalFees, {})} />
                  <BdRow label="price / IL" cls="rd" w={(Math.abs(s.priceIl) / s.bdMax) * 100} bg="#f85149" val={m(s.priceIl, {})} />
                  <div className="bd-div" />
                  <BdRow label="= net" cls={pnlCls} w={(Math.abs(s.totalPnl) / s.bdMax) * 100} bg={s.totalPnl >= 0 ? '#3fb950' : '#f85149'} val={m(s.totalPnl, {})} strong />
                </div>
              </div>

              {multi && (
                <div className="panel">
                  <div className="plabel">─ per wallet · {range}</div>
                  {perWallet.map((w) => (
                    <div className="srow" key={w.wallet}>
                      <span className="dim">{shortAddr(w.wallet)} <span className="wsub">· {w.n} closed</span></span>
                      <span className={w.pnl >= 0 ? 'gr' : 'rd'}>{m(w.pnl, { compact: true })}</span>
                    </div>
                  ))}
                  {data.failed && data.failed.length > 0 && data.failed.map((f) => (
                    <div className="srow" key={f.wallet}>
                      <span className="dim">{shortAddr(f.wallet)}</span>
                      <span className="rd" style={{ fontSize: 11 }}>gagal dimuat</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="panel">
                <div className="perf-head">
                  <span className="plabel" style={{ marginBottom: 0 }}>─ performance · {range}</span>
                  <span className="ctl"><span className="clbl">view</span><Seg value={view} options={['chart', 'calendar']} onChange={setView} /></span>
                </div>
                {view === 'chart'
                  ? <Chart positions={ranged} cur={cur} solUsd={solUsd} usdIdr={usdIdr} />
                  : <Calendar positions={positions} cur={cur} solUsd={solUsd} usdIdr={usdIdr} />}
              </div>

              <div className="panel">
                <div className="plabel">─ closed positions</div>

                <div className="pos-desktop">
                  <table className="ttbl">
                    <thead>
                      <tr><th>pair</th><th>ago</th><th>deposit</th><th>fees</th><th>pnl</th><th>roi</th><th>status</th></tr>
                    </thead>
                    <tbody>
                      {pageItems.map((p, i) => {
                        const st = pnlState(p.pnlSol);
                        const cls = st > 0 ? 'gr' : st < 0 ? 'rd' : 'ev';
                        const tag = st > 0 ? ['tag-g', 'profit ✓'] : st < 0 ? ['tag-r', 'loss ✗'] : ['tag-e', 'impas ≈'];
                        return (
                          <tr key={p.positionAddress || i} className="pos-row" onClick={() => setSelected(p)}>
                            <td className="br">{p.pair}{multi && p.owner && <span className="owner-tag">{shortAddr(p.owner)}</span>}</td>
                            <td className="dim">{sinceStr(p.closedAt)}</td>
                            <td>{m(p.depositSol, { compact: true, unit: false, sign: false })}</td>
                            <td className="gr">{m(p.feesSol, { compact: true, unit: false })}</td>
                            <td className={cls}>{m(p.pnlSol, { compact: true, unit: false })}</td>
                            <td className={cls}>{fmtRoi(p.pnlSol, p.pnlPct)}</td>
                            <td><span className={'tag ' + tag[0]}>{tag[1]}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="pos-mobile">
                  {pageItems.map((p, i) => {
                    const st = pnlState(p.pnlSol);
                    const cls = st > 0 ? 'gr' : st < 0 ? 'rd' : 'ev';
                    const pc = st > 0 ? 'pcard-g' : st < 0 ? 'pcard-r' : 'pcard-e';
                    return (
                      <div key={p.positionAddress || i} className={'pcard ' + pc} onClick={() => setSelected(p)}>
                        <div className="pcard-top">
                          <span className="br">{p.pair}{multi && p.owner && <span className="owner-tag">{shortAddr(p.owner)}</span>}</span>
                          <span className={cls}>{m(p.pnlSol, {})}</span>
                        </div>
                        <div className="pcard-bot dim">
                          <span>{sinceStr(p.closedAt)} · fee {m(p.feesSol, { compact: true, unit: false })}</span>
                          <span className={cls}>{fmtRoi(p.pnlSol, p.pnlPct)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {totalPages > 1 && (
                  <div className="pager">
                    <button className="navbtn" onClick={() => setPage((p) => Math.max(1, Math.min(totalPages, p) - 1))} disabled={curPage === 1}>‹ prev</button>
                    <span className="dim">hal {curPage}/{totalPages}</span>
                    <button className="navbtn" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={curPage === totalPages}>next ›</button>
                  </div>
                )}
              </div>

              <div className="keyhints dim">^D denom · ^R range · ^V view · ←/→ page · q quit</div>
            </>
          )}
        </div>
      </div>

      <div className="foot dim">data: meteora portfolio api · {walletLabel}</div>

      {selected && (
        <PositionModal position={selected} cur={cur} solUsd={solUsd} usdIdr={usdIdr} onClose={() => setSelected(null)} />
      )}

      {showRecap && (
        <RecapCard positions={ranged} cur={cur} solUsd={solUsd} usdIdr={usdIdr} range={range} wallet={walletLabel} onClose={() => setShowRecap(false)} />
      )}

      {tool && (
        <AnalyzeModal
          command={tool}
          positions={ranged}
          wallets={wallets}
          cur={cur}
          solUsd={solUsd}
          usdIdr={usdIdr}
          range={range}
          walletLabel={walletLabel}
          onSelectPosition={setSelected}
          onClose={() => setTool(null)}
        />
      )}
    </div>
  );
}

function Row({ label, value }) {
  return <div className="srow"><span className="dim">{label}</span><span>{value}</span></div>;
}

function BdRow({ label, w, bg, val, cls, strong }) {
  return (
    <div className="bd-row">
      <span className={'bd-l' + (strong ? ' br' : '')}>{label}</span>
      <span className="bd-track"><span style={{ display: 'block', height: '100%', width: Math.max(2, Math.min(100, w)) + '%', background: bg }} /></span>
      <span className={'bd-v ' + cls}>{val}</span>
    </div>
  );
}
