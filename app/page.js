'use client';

import { useState, useCallback } from 'react';
import Landing from '../components/Landing';
import Dashboard from '../components/Dashboard';

export default function Page() {
  const [view, setView] = useState('landing');
  const [wallet, setWallet] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const analyze = useCallback(async (addr) => {
    setError('');
    setWallet(addr);
    setView('loading');
    try {
      const res = await fetch('/api/positions?wallet=' + encodeURIComponent(addr));
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal mengambil data');
      setData(json);
      setView('dashboard');
    } catch (e) {
      setError(e.message || 'Terjadi kesalahan');
      setView('landing');
    }
  }, []);

  const reset = useCallback(() => {
    setView('landing');
    setData(null);
    setError('');
  }, []);

  if (view === 'dashboard' && data) {
    return <Dashboard wallet={wallet} data={data} onReset={reset} />;
  }

  return <Landing onAnalyze={analyze} loading={view === 'loading'} error={error} initial={wallet} />;
}
