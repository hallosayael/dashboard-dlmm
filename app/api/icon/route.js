import { fetchWithTimeout } from '../../../lib/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Proxy gambar logo token supaya same-origin (biar ke-render di PNG hasil download).
export async function GET(request) {
  const u = new URL(request.url).searchParams.get('u') || '';
  if (!/^https?:\/\//i.test(u)) {
    return new Response('bad url', { status: 400 });
  }
  try {
    const r = await fetchWithTimeout(u, {}, 8000);
    if (!r.ok) return new Response('not found', { status: 404 });
    const buf = await r.arrayBuffer();
    const ct = r.headers.get('content-type') || 'image/png';
    return new Response(buf, {
      headers: { 'content-type': ct, 'cache-control': 'public, max-age=86400' },
    });
  } catch (e) {
    return new Response('err', { status: 502 });
  }
}
