const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usdCompact = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 });

export function money(value: number, opts: { sign?: boolean; compact?: boolean } = {}): string {
  if (!Number.isFinite(value)) return '—';
  const v = Math.abs(value) < 0.005 ? 0 : value;
  const body = opts.compact && Math.abs(v) >= 100_000 ? usdCompact.format(Math.abs(v)) : usd.format(Math.abs(v));
  if (opts.sign) return (v > 0 ? '+' : v < 0 ? '−' : '') + body;
  return v < 0 ? '−' + body : body;
}

export function percent(value: number, opts: { sign?: boolean; digits?: number } = {}): string {
  if (!Number.isFinite(value)) return '—';
  const digits = opts.digits ?? 2;
  const v = Math.abs(value) < 0.5 * 10 ** -(digits + 2) ? 0 : value;
  const body = (Math.abs(v) * 100).toFixed(digits) + '%';
  if (opts.sign ?? true) return (v > 0 ? '+' : v < 0 ? '−' : '') + body;
  return v < 0 ? '−' + body : body;
}

export function shares(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const rounded = Math.round(value * 10000) / 10000;
  return rounded.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

export function compactNumber(value: number): string {
  return compact.format(value);
}

export function price(value: number): string {
  return usd.format(value);
}

export function dateTime(t: number): string {
  return new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function shortDate(t: number): string {
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function timeOnly(t: number): string {
  return new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function relativeTime(t: number, now = Date.now()): string {
  const diff = Math.round((now - t) / 1000);
  if (diff < 45) return 'just now';
  if (diff < 3600) return `${Math.round(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)} h ago`;
  if (diff < 86400 * 7) return `${Math.round(diff / 86400)} d ago`;
  return shortDate(t);
}

export function dayGroupLabel(t: number, now = Date.now()): string {
  const d = new Date(t);
  const n = new Date(now);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, n)) return 'Today';
  const y = new Date(now - 86400000);
  if (sameDay(d, y)) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: d.getFullYear() === n.getFullYear() ? undefined : 'numeric' });
}
