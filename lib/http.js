// Helper jaringan: fetch dengan timeout + map berkonkurensi terbatas.

export async function fetchWithTimeout(url, opts = {}, ms = 8000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: c.signal, cache: 'no-store' });
  } finally {
    clearTimeout(t);
  }
}

export async function mapLimit(items, limit, fn) {
  const res = new Array(items.length);
  let i = 0;
  const n = Math.min(limit, items.length) || 0;
  const workers = Array.from({ length: n }, async () => {
    while (i < items.length) {
      const idx = i++;
      res[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return res;
}
