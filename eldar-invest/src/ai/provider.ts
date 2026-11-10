/**
 * Research data providers for ELDAR AI.
 *
 *  - ServerProvider    → real market data through this app's own /api/market
 *                        endpoints (keys stay on the server).
 *  - SimulatedProvider → the ELDAR INVEST simulator, clearly marked as demo.
 *
 * Both implement the same interface, so tools never care where data comes
 * from — they only pass along the `meta` (source, real?, timestamp).
 */
import { create } from 'zustand';
import type { AiRange, BackendStatus } from '@shared/aiTools';
import { ASSETS, getAsset } from '@/data/assets';
import { assetSeries, closeOn, getDayStats, getQuote, priceAt } from '@/lib/market';
import { DAY, dayEnd, dayNumber } from '@/lib/time';
import { indicators, type ScreenRow } from './analytics';
import type { EventItem, Filings, Fundamentals, Meta, NewsItem, Profile, Pt, QuoteInfo } from './types';

export class AiError extends Error {
  constructor(
    public code: string,
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
  }
}

export interface ResearchProvider {
  real: boolean;
  caps: { history: boolean; fundamentals: boolean; news: boolean; filings: boolean };
  quotes(symbols: string[]): Promise<QuoteInfo[]>;
  history(symbol: string, range: AiRange): Promise<{ points: Pt[]; meta: Meta }>;
  /** ~400 daily closes, oldest first. */
  daily(symbol: string): Promise<{ points: Pt[]; meta: Meta }>;
  profile(symbol: string): Promise<Profile>;
  fundamentals(symbol: string): Promise<Fundamentals | null>;
  filings(symbol: string): Promise<Filings | null>;
  news(symbol?: string): Promise<{ items: NewsItem[]; meta: Meta }>;
  events(days: number, symbol?: string): Promise<{ items: EventItem[]; meta: Meta }>;
  screen(): Promise<{ rows: ScreenRow[]; meta: Meta }>;
}

/* ------------------------------ API transport ----------------------------- */

const API_BASE = ((import.meta.env.VITE_API_BASE as string | undefined) ?? '').replace(/\/$/, '');

/** No server exists for the standalone file or sandboxed previews. */
export function serverPossible(): boolean {
  if (API_BASE) return true;
  if (typeof window === 'undefined') return false;
  const { protocol, origin } = window.location;
  return !__STANDALONE__ && origin !== 'null' && (protocol === 'http:' || protocol === 'https:');
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let r: Response;
  try {
    r = await fetch(API_BASE + path, init);
  } catch {
    throw new AiError('network', 'Network error: the ELDAR AI server could not be reached.');
  }
  const type = r.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) throw new AiError('no_server', 'The ELDAR AI server is not available.');
  const body = await r.json().catch(() => null);
  if (!r.ok) {
    const e = body?.error ?? {};
    throw new AiError(e.code ?? 'server', e.message ?? 'The server returned an error.', e.retryAfter);
  }
  return body as T;
}

interface BackendState {
  state: 'unknown' | 'checking' | 'ready' | 'none';
  info: BackendStatus | null;
  check: (force?: boolean) => Promise<void>;
}

export const useBackend = create<BackendState>((set, get) => ({
  state: 'unknown',
  info: null,
  check: async (force) => {
    if (!force && get().state !== 'unknown') return;
    if (!serverPossible()) return set({ state: 'none', info: null });
    set({ state: 'checking' });
    try {
      const info = await api<BackendStatus>('/api/status');
      set({ state: 'ready', info });
    } catch {
      set({ state: 'none', info: null });
    }
  },
}));

/* ---------------------------- Simulated provider --------------------------- */

const SIM = 'ELDAR INVEST simulator';
const simMeta = (): Meta => ({ source: SIM, real: false, asOf: Date.now() });

function requireCatalog(symbol: string) {
  const a = getAsset(symbol);
  if (!a) throw new AiError('unknown_symbol', `${symbol} is not in the ELDAR INVEST catalogue.`);
  return a;
}

function dailyCloses(symbol: string, days: number, now: number): Pt[] {
  const today = dayNumber(now);
  const out: Pt[] = [];
  for (let d = today - days; d < today; d++) out.push({ t: dayEnd(d) - 1, v: closeOn(symbol, d) });
  return out;
}

export function simulatedHistory(symbol: string, range: AiRange, now: number): Pt[] {
  if (range === '6M') return [...dailyCloses(symbol, 182, now), { t: now, v: priceAt(symbol, now) }];
  return assetSeries(symbol, range, now);
}

export class SimulatedProvider implements ResearchProvider {
  real = false;
  caps = { history: true, fundamentals: false, news: false, filings: false };

  async quotes(symbols: string[]): Promise<QuoteInfo[]> {
    const now = Date.now();
    return symbols.map((s) => {
      const a = requireCatalog(s);
      const q = getQuote(a.symbol, now);
      const st = getDayStats(a.symbol, now);
      return { symbol: a.symbol, name: a.name, logo: null, price: q.price, change: q.change, changePct: q.changePct, prevClose: q.prevClose, high: st.high, low: st.low, meta: simMeta() };
    });
  }
  async history(symbol: string, range: AiRange) {
    requireCatalog(symbol);
    return { points: simulatedHistory(symbol, range, Date.now()), meta: simMeta() };
  }
  async daily(symbol: string) {
    requireCatalog(symbol);
    return { points: dailyCloses(symbol, 400, Date.now()), meta: simMeta() };
  }
  async profile(symbol: string): Promise<Profile> {
    const a = requireCatalog(symbol);
    return { name: a.name, logo: null, industry: a.type === 'etf' ? 'ETF' : a.category, exchange: null, country: null, marketCap: null, ipo: null, website: null, description: a.description, meta: simMeta() };
  }
  async fundamentals() {
    return null;
  }
  async filings() {
    return null;
  }
  async news(): Promise<never> {
    throw new AiError('not_configured', 'Real news is unavailable in demo mode.');
  }
  async events(): Promise<never> {
    throw new AiError('not_configured', 'The events calendar is unavailable in demo mode.');
  }
  async screen() {
    const now = Date.now();
    const rows: ScreenRow[] = ASSETS.map((a) => {
      const closes = dailyCloses(a.symbol, 260, now);
      const ind = indicators(closes, priceAt(a.symbol, now));
      const v = closes.map((p) => p.v);
      const back = (n: number) => ind.price / v[v.length - n] - 1;
      return { symbol: a.symbol, ret5d: back(5), ret13w: back(63), ret26w: back(126), ret52w: back(252), risk: ind.volAnnual, pos52: ind.pos52, pe: null, revenueGrowth: null, epsGrowth: null, netMargin: null, roe: null, debtToEquity: null };
    });
    return { rows, meta: simMeta() };
  }
}

/* ------------------------------ Server provider ---------------------------- */

interface QuoteDTO {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  high: number | null;
  low: number | null;
  prevClose: number;
  source: string;
  asOf: number;
}

const profileCache = new Map<string, Promise<Profile>>();

export class ServerProvider implements ResearchProvider {
  real = true;
  caps: ResearchProvider['caps'];

  constructor(private info: BackendStatus['market']) {
    this.caps = { history: !!info.history, fundamentals: !!info.fundamentals, news: !!info.news, filings: !!info.filings };
  }

  private meta(source: string, asOf: number): Meta {
    return { source, real: true, asOf };
  }

  async quotes(symbols: string[]): Promise<QuoteInfo[]> {
    const [d, profiles] = await Promise.all([
      api<{ quotes: QuoteDTO[]; missing: string[] }>(`/api/market?op=quote&symbols=${symbols.map(encodeURIComponent).join(',')}`),
      Promise.all(symbols.map((s) => this.profile(s).catch(() => null))),
    ]);
    if (!d.quotes.length) throw new AiError('no_data', `No market data found for ${symbols.join(', ')}.`);
    return d.quotes.map((q) => {
      const p = profiles[symbols.indexOf(q.symbol)];
      return { symbol: q.symbol, name: p?.name ?? getAsset(q.symbol)?.name ?? q.symbol, logo: p?.logo ?? null, price: q.price, change: q.change, changePct: q.changePct, prevClose: q.prevClose, high: q.high, low: q.low, meta: this.meta(q.source, q.asOf) };
    });
  }

  private async series(symbol: string, range: string) {
    if (!this.caps.history) throw new AiError('not_configured', 'Price history is not configured on the server.');
    const d = await api<{ points: Pt[]; source: string; asOf: number }>(`/api/market?op=history&symbol=${encodeURIComponent(symbol)}&range=${range}`);
    return { points: d.points, meta: this.meta(d.source, d.asOf) };
  }
  history(symbol: string, range: AiRange) {
    return this.series(symbol, range);
  }
  daily(symbol: string) {
    return this.series(symbol, 'D400');
  }

  profile(symbol: string): Promise<Profile> {
    let p = profileCache.get(symbol);
    if (!p) {
      p = api<{ profile: (Omit<Profile, 'meta' | 'description'> & { source: string; asOf: number }) | null }>(`/api/market?op=profile&symbol=${encodeURIComponent(symbol)}`).then((d) => {
        const a = getAsset(symbol);
        if (!d.profile) {
          if (!a) throw new AiError('no_data', `No company profile found for ${symbol}.`);
          return { name: a.name, logo: null, industry: a.category, exchange: null, country: null, marketCap: null, ipo: null, website: null, description: a.description, meta: this.meta(this.info.quotes ?? 'server', Date.now()) };
        }
        const { source, asOf, ...rest } = d.profile;
        return { ...rest, description: a?.description ?? null, meta: this.meta(source, asOf) };
      });
      profileCache.set(symbol, p);
      p.catch(() => profileCache.delete(symbol));
    }
    return p;
  }

  async fundamentals(symbol: string): Promise<Fundamentals | null> {
    if (!this.caps.fundamentals) return null;
    const d = await api<{ metrics: (Omit<Fundamentals, 'meta'> & { source: string; asOf: number }) | null }>(`/api/market?op=metrics&symbol=${encodeURIComponent(symbol)}`);
    if (!d.metrics) return null;
    const { source, asOf, ...rest } = d.metrics;
    return { ...rest, meta: this.meta(source, asOf) };
  }

  async filings(symbol: string): Promise<Filings | null> {
    if (!this.caps.filings) return null;
    const d = await api<{ filings: (Omit<Filings, 'meta'> & { source: string; asOf: number }) | null }>(`/api/market?op=filings&symbol=${encodeURIComponent(symbol)}`);
    if (!d.filings) return null;
    const { source, asOf, ...rest } = d.filings;
    return { ...rest, meta: this.meta(source, asOf) };
  }

  async news(symbol?: string) {
    if (!this.caps.news) throw new AiError('not_configured', 'A news provider is not configured on the server.');
    const d = await api<{ items: NewsItem[]; source: string; asOf: number }>(`/api/market?op=news${symbol ? `&symbol=${encodeURIComponent(symbol)}` : ''}`);
    return { items: d.items, meta: this.meta(d.source, d.asOf) };
  }

  async events(days: number, symbol?: string) {
    if (!this.caps.news) throw new AiError('not_configured', 'An events provider is not configured on the server.');
    const d = await api<{ items: EventItem[]; source: string; asOf: number }>(`/api/market?op=events&days=${days}${symbol ? `&symbol=${encodeURIComponent(symbol)}` : ''}`);
    return { items: d.items, meta: this.meta(d.source, d.asOf) };
  }

  async screen() {
    const d = await api<{ rows: (Fundamentals & { symbol: string; ret5d: number | null; ret26w: number | null; high52: number | null; low52: number | null })[]; source: string; asOf: number }>('/api/market?op=screen');
    const rows: ScreenRow[] = d.rows.map((m) => ({
      symbol: m.symbol,
      ret5d: m.ret5d,
      ret13w: m.ret13w,
      ret26w: m.ret26w,
      ret52w: m.ret52w,
      risk: m.beta,
      pos52: null,
      pe: m.pe !== null && m.pe > 0 ? m.pe : null,
      revenueGrowth: m.revenueGrowth,
      epsGrowth: m.epsGrowth,
      netMargin: m.netMargin,
      roe: m.roe,
      debtToEquity: m.debtToEquity,
    }));
    return { rows, meta: this.meta(d.source, d.asOf) };
  }
}

const simulated = new SimulatedProvider();
let server: { key: string; p: ServerProvider } | null = null;

/** Real data when the server has a quote provider; otherwise the simulator. */
export function getProvider(): ResearchProvider {
  const info = useBackend.getState().info;
  if (!info?.market.quotes) return simulated;
  const key = JSON.stringify(info.market);
  if (!server || server.key !== key) server = { key, p: new ServerProvider(info.market) };
  return server.p;
}

export function geminiAvailable(): boolean {
  return !!useBackend.getState().info?.ai.enabled;
}

export { DAY };
