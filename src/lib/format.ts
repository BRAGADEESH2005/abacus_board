// Client safe formatting and parsing helpers.

export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = input.replace(/[^\d+]/g, '');
  if (/^\+91[6-9]\d{9}$/.test(digits)) return digits;
  const d = digits.replace(/^\+/, '');
  if (/^[6-9]\d{9}$/.test(d)) return `+91${d}`;
  if (/^91[6-9]\d{9}$/.test(d)) return `+${d}`;
  if (/^0[6-9]\d{9}$/.test(d)) return `+91${d.slice(1)}`;
  return null;
}

export function displayPhone(p: string | null | undefined): string {
  if (!p) return '';
  const m = /^\+91(\d{5})(\d{5})$/.exec(p);
  return m ? `+91 ${m[1]} ${m[2]}` : p;
}

export function inr(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

/** ₹35 lakh / ₹1.2 Cr style for revenue tiles. */
export function inrShort(n: number): string {
  if (!n) return '₹0';
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(n >= 1e8 ? 0 : 2).replace(/\.?0+$/, '')} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(n >= 1e6 ? 1 : 2).replace(/\.?0+$/, '')} lakh`;
  return inr(n);
}

export function num(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return Math.round(n).toLocaleString('en-IN');
}

export function sqft(min?: number | null, max?: number | null): string {
  if (min && max) return min === max ? `${num(min)} sq ft` : `${num(min)} to ${num(max)} sq ft`;
  if (min) return `${num(min)}+ sq ft`;
  return 'Any size';
}

export function rentRange(min?: number | null, max?: number | null): string {
  if (min && max) return `₹${num(min)} to ${num(max)} per sq ft`;
  return 'Open';
}

const IST = 'Asia/Kolkata';

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: IST });
}

export function fmtDateTime(d: string | Date | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: IST });
}

export function ago(d: string | Date | null | undefined, now = Date.now()): string {
  if (!d) return '';
  const s = Math.max(0, Math.floor((now - new Date(d).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const days = Math.floor(h / 24);
  if (days < 60) return `${days} day${days === 1 ? '' : 's'} ago`;
  const mo = Math.floor(days / 30);
  return `${mo} months ago`;
}

export function daysSince(d: string | Date | null | undefined, now = Date.now()): number {
  if (!d) return 0;
  return Math.floor((now - new Date(d).getTime()) / 86400000);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

export function avatarColor(seed: string): string {
  const colors = ['#7F1416', '#3E3F3B', '#9A6408', '#2F6B3F', '#6B3F7F', '#1F5A7A', '#7A4B1F'];
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return colors[h % colors.length]!;
}
