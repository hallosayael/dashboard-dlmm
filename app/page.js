'use client';

import { useState, useCallback, useEffect } from 'react';
import Landing from '../components/Landing';
import Dashboard from '../components/Dashboard';

export default function Page() {
  const [view, setView] = useState('landing');
  const [wallet, setWallet] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // load(addr): silent=true -> refresh di tempat (dashboard tetap tampil, tak reload).
  const load = useCallback(async (addr, opts = {}) => {
    const silent = !!opts.silent;
    if (!addr) return;
    setError('');
    if (silent) setRefreshing(true);
    else { setWallet(addr); setView('loading'); }
    try {
      // &t= untuk melewati cache browser supaya benar-benar data terbaru.
      const res = await fetch(`/api/positions?wallet=${encodeURIComponent(addr)}&t=${Date.now()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal mengambil data');
      setWallet(addr);
      setData(json);
      setView('dashboard');
      // simpan wallet di URL -> Ctrl+R / buka ulang tidak balik ke halaman awal.
      try { window.history.replaceState(null, '', `?wallet=${encodeURIComponent(addr)}`); } catch (_) {}
    } catch (e) {
      if (!silent) { setError(e.message || 'Terjadi kesalahan'); setView('landing'); }
      // saat refresh silent gagal: biarkan data lama tetap tampil.
    } finally {
      if (silent) setRefreshing(false);
    }
  }, []);

  const analyze = useCallback((addr) => load(addr), [load]);
  const refresh = useCallback(() => { if (wallet) load(wallet, { silent: true }); }, [load, wallet]);

  const reset = useCallback(() => {
    setView('landing');
    setData(null);
    setError('');
    setWallet('');
    try { window.history.replaceState(null, '', window.location.pathname); } catch (_) {}
  }, []);

  // buka ulang: kalau ada ?wallet= di URL, langsung muat (tak perlu paste lagi).
  useEffect(() => {
    try {
      const w = new URLSearchParams(window.location.search).get('wallet');
      if (w) load(w);
    } catch (_) {}
  }, [load]);

  if (view === 'dashboard' && data) {
    return <Dashboard wallet={wallet} data={data} onReset={reset} onRefresh={refresh} refreshing={refreshing} />;
  }

  return <Landing onAnalyze={analyze} loading={view === 'loading'} error={error} initial={wallet} />;
}
