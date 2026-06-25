// Helper format — aman dipakai di client maupun server (tanpa side-effect).

export function fmtSol(n, dp = 3, sign = true) {
  if (!Number.isFinite(n)) n = 0;
  const s = n.toFixed(dp);
  if (sign && n >= 0) return '+' + s;
  return s; // angka negatif sudah membawa tanda '-'
}

export function fmtNum(n, dp = 2) {
  if (!Number.isFinite(n)) n = 0;
  return n.toFixed(dp);
}

export function fmtPct(n) {
  if (!Number.isFinite(n)) n = 0;
  const r = Math.round(n);
  return (r >= 0 ? '+' : '') + r + '%';
}

export function shortAddr(a) {
  if (!a) return '';
  if (a.length <= 10) return a;
  return a.slice(0, 4) + '…' + a.slice(-4);
}

export function ageStr(days) {
  if (days === null || days === undefined || !Number.isFinite(days)) return '—';
  return Math.max(0, Math.round(days)) + 'd';
}

// "Berapa lama sejak ditutup" — dihitung mundur dari sekarang ke closedAt (unix detik).
export function sinceStr(closedSec) {
  if (!closedSec || !Number.isFinite(closedSec)) return '—';
  const diff = Date.now() / 1000 - closedSec;
  if (diff < 0) return '0m';
  if (diff < 3600) return Math.max(1, Math.round(diff / 60)) + 'm';
  if (diff < 86400) return Math.round(diff / 3600) + 'h';
  return Math.round(diff / 86400) + 'd';
}

// Pecah unix-detik (UTC) menjadi tanggal pada timezone tertentu (default GMT+7).
export function tzYMD(sec, tzHours = 7) {
  const d = new Date((sec + tzHours * 3600) * 1000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate() };
}

export const MONTH_NAMES = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
];
