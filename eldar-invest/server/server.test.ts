// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ASSETS } from '../src/data/assets';
import { AI_TOOLS } from '../shared/aiTools';
import { CATALOG } from './catalog';
import { pickModel } from './gemini';
import { clearCache, HttpError, rateLimit, validSymbol } from './http';
import { filings } from './providers/edgar';
import { metrics, quote } from './providers/finnhub';
import { history } from './providers/twelvedata';

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

beforeEach(() => {
  clearCache();
  process.env.FINNHUB_API_KEY = 'k1';
  process.env.TWELVEDATA_API_KEY = 'k2';
});
afterEach(() => vi.unstubAllGlobals());

describe('server catalogue and tools', () => {
  it('matches the app catalogue', () => {
    expect([...CATALOG].sort()).toEqual(ASSETS.map((a) => a.symbol).sort());
  });
  it('declares well-formed tools', () => {
    expect(new Set(AI_TOOLS.map((t) => t.name)).size).toBe(AI_TOOLS.length);
    for (const t of AI_TOOLS) expect(t.parameters.type).toBe('object');
  });
});

describe('model selection', () => {
  const m = (name: string, gen = true) => ({ name: `models/${name}`, supportedGenerationMethods: gen ? ['generateContent'] : ['embedContent'] });
  it('prefers the newest stable Flash model', () => {
    expect(pickModel([m('gemini-3.6-flash'), m('gemini-3.8-flash'), m('gemini-3.8-flash-lite'), m('gemini-4.0-pro'), m('gemini-3.9-flash-preview-tts'), m('gemini-3.9-flash-image')])).toBe('gemini-3.8-flash');
  });
  it('falls back to Flash-Lite, then to nothing', () => {
    expect(pickModel([m('gemini-3.5-flash-lite'), m('gemini-4.0-pro')])).toBe('gemini-3.5-flash-lite');
    expect(pickModel([m('gemini-3.8-flash', false), m('text-embedding-5')])).toBeNull();
  });
});

describe('http helpers', () => {
  it('validates ticker symbols', () => {
    expect(validSymbol(' brk.b ')).toBe('BRK.B');
    for (const bad of ['', '../etc', 'A B', '<x>', 'TOOLONGSYM']) expect(() => validSymbol(bad)).toThrow(HttpError);
  });
  it('rate-limits with a retry hint', () => {
    for (let i = 0; i < 3; i++) rateLimit('t:1', 3, 60_000);
    try {
      rateLimit('t:1', 3, 60_000);
      expect.unreachable();
    } catch (e) {
      expect((e as HttpError).status).toBe(429);
      expect((e as HttpError).retryAfter).toBeGreaterThan(0);
    }
    expect(() => rateLimit('t:2', 3, 60_000)).not.toThrow();
  });
});

describe('Finnhub adapter', () => {
  it('maps quotes, sends the key in a header and treats zeros as "no data"', async () => {
    const f = vi.fn(async (url: string, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>)['X-Finnhub-Token']).toBe('k1');
      expect(url).not.toContain('k1');
      return url.includes('symbol=NOPE') ? ok({ c: 0, pc: 0, t: 0 }) : ok({ c: 200, d: -2, dp: -0.99, h: 203, l: 198, o: 201, pc: 202, t: 1700000000 });
    });
    vi.stubGlobal('fetch', f);
    const q = await quote('AAPL');
    expect(q).toMatchObject({ price: 200, change: -2, prevClose: 202, source: 'Finnhub', asOf: 1700000000000 });
    expect(q!.changePct).toBeCloseTo(-0.0099);
    expect(await quote('NOPE')).toBeNull();
    await quote('AAPL');
    expect(f).toHaveBeenCalledTimes(2); // second AAPL call served from cache
  });
  it('converts percentage metrics to fractions and keeps missing values null', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (url.includes('/stock/earnings') ? ok([]) : ok({ metric: { peTTM: 30, netProfitMarginTTM: 25, revenueGrowthTTMYoy: -5 } }))));
    const m = await metrics('AAPL');
    expect(m).toMatchObject({ pe: 30, netMargin: 0.25, revenueGrowth: -0.05, roe: null, debtToEquity: null });
  });
  it('surfaces provider rate limits', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 429, headers: { 'retry-after': '12' } })));
    await expect(quote('MSFT')).rejects.toMatchObject({ status: 429, code: 'provider_rate_limited', retryAfter: 12 });
  });
});

describe('Twelve Data adapter', () => {
  it('parses series oldest-first', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok({ status: 'ok', values: [{ datetime: '2026-11-05', close: '10.5' }, { datetime: '2026-11-06', close: '11' }] })));
    const h = await history('AAPL', '1M');
    expect(h.points.map((p) => p.v)).toEqual([10.5, 11]);
    expect(h.source).toBe('Twelve Data');
    expect(h.asOf).toBe(Date.parse('2026-11-06T21:00:00Z'));
  });
  it('detects quota errors reported inside a 200 response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok({ status: 'error', code: 429, message: 'out of credits' })));
    await expect(history('AAPL', '1Y')).rejects.toMatchObject({ status: 429 });
    await expect(history('AAPL', 'bogus')).rejects.toMatchObject({ status: 400 });
  });
});

describe('SEC EDGAR adapter', () => {
  it('picks the latest full fiscal year and matching balance-sheet values', async () => {
    const yr = (val: number, fy: number) => ({ start: `${fy - 1}-10-01`, end: `${fy}-09-30`, val, fy, fp: 'FY', form: '10-K', filed: `${fy}-11-01` });
    const facts = {
      RevenueFromContractWithCustomerExcludingAssessedTax: { units: { USD: [yr(380e9, 2024), yr(400e9, 2025), { start: '2025-07-01', end: '2025-09-30', val: 95e9, fy: 2025, fp: 'Q4', form: '10-K', filed: '2025-11-01' }, { ...yr(390e9, 2024), filed: '2025-11-01' }] } },
      NetIncomeLoss: { units: { USD: [yr(94e9, 2024), yr(100e9, 2025)] } },
      Assets: { units: { USD: [{ end: '2025-09-30', val: 360e9, fy: 2025, fp: 'FY', form: '10-K', filed: '2025-11-01' }, { end: '2024-09-30', val: 350e9, fy: 2025, fp: 'FY', form: '10-K', filed: '2025-11-01' }] } },
    };
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>)['User-Agent']).toContain('ELDAR');
      return url.includes('company_tickers') ? ok({ 0: { cik_str: 320193, ticker: 'AAPL' } }) : (expect(url).toContain('CIK0000320193.json'), ok({ facts: { 'us-gaap': facts } }));
    }));
    const f = await filings('AAPL');
    expect(f).toMatchObject({ fiscalYear: 2025, periodEnd: '2025-09-30', revenue: 400e9, revenuePrev: 390e9, netIncome: 100e9, netIncomePrev: 94e9, assets: 360e9, liabilities: null, longTermDebt: null });
    expect(f!.source).toBe('SEC EDGAR (Form 10-K)');
  });
  it('returns null for companies without US-GAAP annual reports', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (url.includes('company_tickers') ? ok({ 0: { cik_str: 1, ticker: 'SPY' } }) : ok({ facts: { 'ifrs-full': {} } }))));
    expect(await filings('SPY')).toBeNull();
    expect(await filings('ZZZZ')).toBeNull();
  });
});
