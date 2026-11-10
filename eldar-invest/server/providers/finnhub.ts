/**
 * Finnhub adapter (https://finnhub.io). Free plan: about 60 calls/minute,
 * licensed for personal use. Used for quotes, company profiles (with logos),
 * key metrics, earnings, company and market news. Historical candles are a
 * premium Finnhub endpoint, so price history comes from another adapter.
 */
import { cached, env, upstream } from '../http.js';
import type { EarningsRow, EventDTO, MetricsDTO, NewsDTO, ProfileDTO, QuoteDTO } from './types.js';

const NAME = 'Finnhub';
const base = () => env('FINNHUB_API_BASE') ?? 'https://finnhub.io/api/v1';
export const finnhubEnabled = () => !!env('FINNHUB_API_KEY');

function get(path: string, params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  return upstream(NAME, `${base()}${path}?${qs}`, { headers: { 'X-Finnhub-Token': env('FINNHUB_API_KEY') ?? '' } });
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const pct = (v: unknown): number | null => (num(v) === null ? null : (v as number) / 100);

export function quote(symbol: string): Promise<QuoteDTO | null> {
  return cached(`fh:q:${symbol}`, 30_000, async () => {
    const d = (await get('/quote', { symbol })) as Record<string, unknown>;
    const price = num(d.c);
    const prev = num(d.pc);
    // Finnhub answers unknown symbols with zeros rather than an error.
    if (!price || !prev) return null;
    return {
      symbol,
      price,
      change: num(d.d) ?? price - prev,
      changePct: pct(d.dp) ?? (price - prev) / prev,
      open: num(d.o),
      high: num(d.h),
      low: num(d.l),
      prevClose: prev,
      source: NAME,
      asOf: num(d.t) ? (d.t as number) * 1000 : Date.now(),
    };
  });
}

export function profile(symbol: string): Promise<ProfileDTO | null> {
  return cached(`fh:p:${symbol}`, 24 * 3600_000, async () => {
    const d = (await get('/stock/profile2', { symbol })) as Record<string, unknown>;
    if (!d || typeof d.name !== 'string') return null;
    const cap = num(d.marketCapitalization);
    return {
      symbol,
      name: d.name,
      logo: typeof d.logo === 'string' && d.logo.startsWith('https://') ? d.logo : null,
      industry: (d.finnhubIndustry as string) || null,
      exchange: (d.exchange as string) || null,
      country: (d.country as string) || null,
      currency: (d.currency as string) || null,
      marketCap: cap === null ? null : cap * 1e6,
      ipo: (d.ipo as string) || null,
      website: typeof d.weburl === 'string' && d.weburl.startsWith('http') ? d.weburl : null,
      source: NAME,
      asOf: Date.now(),
    };
  });
}

export function metrics(symbol: string): Promise<MetricsDTO | null> {
  return cached(`fh:m:${symbol}`, 12 * 3600_000, async () => {
    const [raw, earn] = await Promise.all([
      get('/stock/metric', { symbol, metric: 'all' }) as Promise<{ metric?: Record<string, unknown> }>,
      (get('/stock/earnings', { symbol }) as Promise<unknown>).catch(() => []),
    ]);
    const m = raw?.metric;
    if (!m || Object.keys(m).length === 0) return null;
    const earnings: EarningsRow[] = (Array.isArray(earn) ? earn : []).slice(0, 4).map((e: Record<string, unknown>) => ({
      period: String(e.period ?? ''),
      actual: num(e.actual),
      estimate: num(e.estimate),
      surprisePct: pct(e.surprisePercent),
    }));
    return {
      symbol,
      pe: num(m.peTTM) ?? num(m.peBasicExclExtraTTM),
      eps: num(m.epsTTM) ?? num(m.epsBasicExclExtraItemsTTM),
      beta: num(m.beta),
      high52: num(m['52WeekHigh']),
      low52: num(m['52WeekLow']),
      ret5d: pct(m['5DayPriceReturnDaily']),
      ret13w: pct(m['13WeekPriceReturnDaily']),
      ret26w: pct(m['26WeekPriceReturnDaily']),
      ret52w: pct(m['52WeekPriceReturnDaily']),
      revenueGrowth: pct(m.revenueGrowthTTMYoy),
      epsGrowth: pct(m.epsGrowthTTMYoy),
      netMargin: pct(m.netProfitMarginTTM),
      grossMargin: pct(m.grossMarginTTM),
      roe: pct(m.roeTTM),
      debtToEquity: num(m['totalDebt/totalEquityQuarterly']) ?? num(m['totalDebt/totalEquityAnnual']),
      currentRatio: num(m.currentRatioQuarterly) ?? num(m.currentRatioAnnual),
      dividendYield: pct(m.dividendYieldIndicatedAnnual),
      earnings,
      source: NAME,
      asOf: Date.now(),
    };
  });
}

function mapNews(list: unknown, symbol: string | null): NewsDTO[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((n) => n && typeof n.headline === 'string' && typeof n.url === 'string' && /^https?:\/\//.test(n.url))
    .sort((a, b) => (b.datetime ?? 0) - (a.datetime ?? 0))
    .slice(0, 10)
    .map((n) => ({
      headline: String(n.headline).slice(0, 300),
      source: String(n.source ?? 'Unknown'),
      url: String(n.url),
      publishedAt: (Number(n.datetime) || 0) * 1000,
      summary: String(n.summary ?? '').slice(0, 500),
      related: symbol ?? (n.related ? String(n.related) : null),
    }));
}

const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

export function companyNews(symbol: string): Promise<NewsDTO[]> {
  return cached(`fh:n:${symbol}`, 10 * 60_000, async () => {
    const now = Date.now();
    return mapNews(await get('/company-news', { symbol, from: iso(now - 10 * 86400_000), to: iso(now) }), symbol);
  });
}

export function marketNews(): Promise<NewsDTO[]> {
  return cached('fh:n:general', 10 * 60_000, async () => mapNews(await get('/news', { category: 'general' }), null));
}

export function earningsCalendar(days: number, symbol?: string): Promise<EventDTO[]> {
  return cached(`fh:cal:${days}:${symbol ?? '*'}`, 3600_000, async () => {
    const now = Date.now();
    const params: Record<string, string> = { from: iso(now), to: iso(now + days * 86400_000) };
    if (symbol) params.symbol = symbol;
    const d = (await get('/calendar/earnings', params)) as { earningsCalendar?: Record<string, unknown>[] };
    return (d.earningsCalendar ?? []).map((e) => ({
      symbol: String(e.symbol ?? ''),
      date: String(e.date ?? ''),
      hour: e.hour ? String(e.hour) : null,
      epsEstimate: num(e.epsEstimate),
      revenueEstimate: num(e.revenueEstimate),
    }));
  });
}

export const FINNHUB_NAME = NAME;
