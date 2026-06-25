'use client';

import { useMemo, useState } from 'react';
import Calendar from './Calendar';

const PAGE_SIZE = 15;
import { fmtSol, fmtNum, fmtPct, shortAddr, sinceStr } from '../lib/format';

export default function Dashboard({ wallet, data, onReset }) {
  const positions = data.positions || [];

  const s = useMemo(() => {
    const n = positions.length;
    const totalPnl = positions.reduce((a, p) => a + p.pnlSol, 0);
    const totalFees = positions.reduce((a, p) => a + p.feesSol, 0);
    const wins = positions.filter((p) => p.pnlSol > 0).length;
    const losses = n - wins;
    const winRate = n ? (wins / n) * 100 : 0;
    const avg = n ? totalPnl / n : 0;
    let best = null, worst = null;
    for (const p of positions) {
      if (!best || p.pnlSol > best.pnlSol) best = p;
      if (!worst || p.pnlSol < worst.pnlSol) worst = p;
    }
    const bars = [...positions].sort((a, b) => b.pnlSol - a.pnlSol).slice(0, 14);
    const maxAbs = bars.reduce((m, p) => Math.max(m, Math.abs(p.pnlSol)), 0) || 1;
    return { n, totalPnl, totalFees, wins, losses, winRate, avg, best, worst, bars, maxAbs };
  }, [positions]);

  const pnlCls = s.totalPnl >= 0 ? 'gr' : 'rd';

  const [page, setPage] = useState(1);
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
            <span className="gr">meridian@dlmm</span>
            <span className="dim">:</span>
            <span className="cy">~/closed</span>
            <span className="dim">$ </span>
            dlmm stats <span className="am">--wallet</span> {shortAddr(wallet)}{' '}
            <span className="am">--closed</span> <span className="am">--denom</span> sol
          </div>

          {data.demo && (
            <div className="demo-banner">mode demo · data contoh — tempel wallet asli untuk data sungguhan</div>
          )}

          {s.n === 0 ? (
            <div className="panel empty-state">
              <div className="plabel">─ closed positions</div>
              <p className="dim">Tidak ada posisi DLMM closed untuk wallet ini.</p>
            </div>
          ) : (
            <>
              <div className="row2">
                <div className="panel">
                  <div className="plabel">─ summary · {s.n} closed</div>
                  <Row label="net pnl" value={<span className={pnlCls}>{fmtSol(s.totalPnl)} SOL</span>} />
                  <Row label="fees earned" value={<span className="gr">{fmtSol(s.totalFees)} SOL</span>} />
                  <Row label="avg / position" value={<span className="br">{fmtSol(s.avg)} SOL</span>} />
                  <Row
                    label="win rate"
                    value={<span className="br">{Math.round(s.winRate)}% <span className="dim">({s.wins}W / {s.losses}L)</span></span>}
                  />
                  {s.best && (
                    <Row label="best" value={<span className="gr">{s.best.pair} {fmtSol(s.best.pnlSol)}</span>} />
                  )}
                  {s.worst && (
                    <Row label="worst" value={<span className="rd">{s.worst.pair} {fmtSol(s.worst.pnlSol)}</span>} />
                  )}
                </div>

                <div className="panel">
                  <div className="plabel">─ pnl per position (sol)</div>
                  <div className="bars">
                    {s.bars.map((p, i) => (
                      <div
                        key={i}
                        className="bar-col"
                        title={p.pair + ' ' + fmtSol(p.pnlSol)}
                        style={{
                          height: Math.max(6, (Math.abs(p.pnlSol) / s.maxAbs) * 100) + '%',
                          background: p.pnlSol >= 0 ? '#3fb950' : '#f85149',
                        }}
                      />
                    ))}
                  </div>
                  <div className="dim barnote">{s.wins} win · {s.losses} loss · sorted by pnl</div>
                </div>
              </div>

              <Calendar positions={positions} />

              <div className="panel">
                <div className="plabel">─ closed positions</div>

                <div className="pos-desktop">
                  <table className="ttbl">
                    <thead>
                      <tr>
                        <th>pair</th><th>ago</th><th>deposit</th>
                        <th>fees</th><th>pnl (sol)</th><th>roi</th><th>status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems.map((p, i) => {
                        const win = p.pnlSol >= 0;
                        return (
                          <tr key={p.positionAddress || i}>
                            <td className="br">{p.pair}</td>
                            <td className="dim">{sinceStr(p.closedAt)}</td>
                            <td>{fmtNum(p.depositSol)}</td>
                            <td className="gr">{fmtSol(p.feesSol)}</td>
                            <td className={win ? 'gr' : 'rd'}>{fmtSol(p.pnlSol)}</td>
                            <td className={win ? 'gr' : 'rd'}>{fmtPct(p.pnlPct)}</td>
                            <td>
                              <span className={'tag ' + (win ? 'tag-g' : 'tag-r')}>
                                {win ? 'profit ✓' : 'loss ✗'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="pos-mobile">
                  {pageItems.map((p, i) => {
                    const win = p.pnlSol >= 0;
                    return (
                      <div key={p.positionAddress || i} className={'pcard ' + (win ? 'pcard-g' : 'pcard-r')}>
                        <div className="pcard-top">
                          <span className="br">{p.pair}</span>
                          <span className={win ? 'gr' : 'rd'}>{fmtSol(p.pnlSol)} SOL</span>
                        </div>
                        <div className="pcard-bot dim">
                          <span>{sinceStr(p.closedAt)} · fee {fmtSol(p.feesSol)}</span>
                          <span className={win ? 'gr' : 'rd'}>{fmtPct(p.pnlPct)}</span>
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

                <div className="dim hint-foot">
                  {s.n} closed · denom SOL · harga SOL ${fmtNum(data.solPrice)} · GMT+7
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="foot dim">data: meteora portfolio api · {data.demo ? 'demo' : shortAddr(wallet)}</div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="srow">
      <span className="dim">{label}</span>
      <span>{value}</span>
    </div>
  );
}
