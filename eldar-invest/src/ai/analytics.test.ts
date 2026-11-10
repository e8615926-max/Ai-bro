import { describe, expect, it } from 'vitest';
import { ASSETS } from '@/data/assets';
import { createUserData, executeTrade } from '@/domain/account';
import { buildForecast, indicators, rsi, scoreUniverse, type ScreenRow } from './analytics';
import { DESCRIPTION_RU } from './descriptions';
import { SimulatedProvider } from './provider';
import { trimWire } from './store';
import { analyzePortfolioData, runTool, type ToolContext } from './tools';
import type { Pt } from './types';

const series = (n: number, f: (i: number) => number): Pt[] => Array.from({ length: n }, (_, i) => ({ t: i * 86400_000, v: f(i) }));
const META = { source: 'test', real: true, asOf: 0 };

describe('indicators', () => {
  it('computes RSI extremes', () => {
    expect(rsi(series(40, (i) => 100 + i).map((p) => p.v))).toBe(100);
    expect(rsi(series(40, (i) => 100 - i).map((p) => p.v))).toBeCloseTo(0, 5);
    expect(rsi([1, 2, 3])).toBeNull();
  });
  it('computes averages, returns and range position', () => {
    const ind = indicators(series(300, (i) => 100 + i * 0.5), 250);
    expect(ind.sma20).toBeGreaterThan(ind.sma200!);
    expect(ind.ret1m).toBeGreaterThan(0);
    expect(ind.pos52).toBe(1);
    expect(ind.maxDrawdown).toBe(0);
  });
});

describe('scenario forecast', () => {
  const daily = series(300, (i) => 100 * Math.exp(0.012 * Math.sin(i / 3) + 0.0004 * i));
  const price = daily[daily.length - 1].v;
  it('produces ordered, non-overlapping ranges around the current price', () => {
    const f = buildForecast({ symbol: 'X', name: 'X', horizon: 'week', daily, price, meta: META })!;
    const [bull, neutral, bear] = f.scenarios;
    expect(bear.low).toBeLessThan(bear.high);
    expect(bear.high).toBeCloseTo(neutral.low, 6);
    expect(neutral.high).toBeCloseTo(bull.low, 6);
    expect(neutral.low).toBeLessThan(price);
    expect(neutral.high).toBeGreaterThan(price);
    expect(f.rangeLow).toBeGreaterThan(bear.low);
    expect(f.rangeHigh).toBeLessThan(bull.high);
    expect(f.scenarios.reduce((s, x) => s + x.probability, 0)).toBeCloseTo(1, 6);
    expect(f.scenarios.every((s) => s.probability > 0.2 && s.probability < 0.45)).toBe(true);
  });
  it('widens with the horizon and never claims high confidence', () => {
    const w = (h: 'day' | 'week' | 'month') => {
      const f = buildForecast({ symbol: 'X', name: 'X', horizon: h, daily, price, meta: META })!;
      return { width: f.rangeHigh - f.rangeLow, conf: f.confidence };
    };
    expect(w('day').width).toBeLessThan(w('week').width);
    expect(w('week').width).toBeLessThan(w('month').width);
    expect(w('month').conf).toBe('low');
    expect(['low', 'medium']).toContain(w('day').conf);
  });
  it('flags simulated data as low confidence and refuses thin history', () => {
    const f = buildForecast({ symbol: 'X', name: 'X', horizon: 'day', daily, price, meta: { ...META, real: false } })!;
    expect(f.quality).toBe('simulated');
    expect(f.confidence).toBe('low');
    expect(f.risks.some((r) => r.key === 'risk.simulated')).toBe(true);
    expect(buildForecast({ symbol: 'X', name: 'X', horizon: 'day', daily: daily.slice(0, 20), price, meta: META })).toBeNull();
  });
});

describe('screening', () => {
  const row = (symbol: string, r: Partial<ScreenRow>): ScreenRow => ({ symbol, ret5d: null, ret13w: null, ret26w: null, ret52w: null, risk: null, pos52: null, pe: null, revenueGrowth: null, epsGrowth: null, netMargin: null, roe: null, debtToEquity: null, ...r });
  it('ranks by horizon-specific factors and ignores single-factor rows', () => {
    const rows = [row('MOMO', { ret5d: 0.05, ret13w: 0.3, risk: 2 }), row('QUAL', { roe: 0.4, netMargin: 0.3, revenueGrowth: 0.1, debtToEquity: 0.1, pe: 15, ret13w: -0.1, ret5d: -0.01, risk: 0.8 }), row('WEAK', { roe: 0.02, netMargin: 0.01, revenueGrowth: -0.1, debtToEquity: 3, pe: 80, ret13w: -0.3, ret5d: -0.05, risk: 1.5 }), row('THIN', { ret13w: 0.9 })];
    expect(scoreUniverse(rows, 'short')[0].row.symbol).toBe('MOMO');
    expect(scoreUniverse(rows, 'long')[0].row.symbol).toBe('QUAL');
    expect(scoreUniverse(rows, 'long').find((s) => s.row.symbol === 'THIN')!.score).toBe(0);
  });
});

describe('tools on the simulated provider', () => {
  const NOW = Date.now();
  const data = createUserData({ uid: 'u', name: 'T', email: 't@e.co' }, { samplePortfolio: true, now: NOW });
  const ctx: ToolContext = { lang: 'en', provider: new SimulatedProvider(), data };

  it('has a Russian description for every catalogue asset', () => {
    for (const a of ASSETS) expect(DESCRIPTION_RU[a.symbol]).toBeTruthy();
  });
  it('analyses the portfolio consistently', () => {
    const a = analyzePortfolioData(ctx);
    expect(a.positions.length).toBe(7);
    expect(a.positions.reduce((s, p) => s + p.riskShare, 0)).toBeCloseTo(1, 6);
    expect(a.sectors.reduce((s, p) => s + p.weight, 0)).toBeCloseTo(1, 6);
    expect(a.total).toBeCloseTo(a.cash + a.invested, 6);
  });
  it('never proposes an impossible trade and never executes one', async () => {
    const before = JSON.stringify(ctx.data);
    const ok = await runTool(ctx, 'propose_trade', { side: 'buy', symbol: 'TSLA', amount_usd: 500 });
    expect(ok.blocks[0]).toMatchObject({ type: 'trade', proposal: { status: 'pending', estTotal: 500 } });
    expect(ok.result).toMatchObject({ executed: false, status: 'AWAITING_USER_CONFIRMATION' });
    for (const bad of [{ side: 'buy', symbol: 'TSLA', amount_usd: 1e9 }, { side: 'sell', symbol: 'BA', shares: 1 }, { side: 'sell', symbol: 'AAPL', shares: 1e6 }, { side: 'buy', symbol: 'FAKE', amount_usd: 10 }, { side: 'buy', symbol: 'TSLA' }]) {
      const r = await runTool(ctx, 'propose_trade', bad);
      expect(r.blocks.every((b) => b.type !== 'trade')).toBe(true);
      expect(r.result.error).toBeTruthy();
    }
    const half = await runTool(ctx, 'propose_trade', { side: 'sell', symbol: 'NVDA', fraction: 0.5 });
    expect(half.blocks[0]).toMatchObject({ type: 'trade', proposal: { shares: Math.round(data.holdings.NVDA.shares * 0.5 * 1e6) / 1e6 } });
    expect(JSON.stringify(ctx.data)).toBe(before);
  });
  it('computes what-if arithmetic', async () => {
    const pos = analyzePortfolioData(ctx).positions.find((p) => p.symbol === 'AAPL')!;
    const r = await runTool(ctx, 'what_if', { changes: [{ symbol: 'AAPL', pct: -10 }] });
    expect(r.result.change as number).toBeCloseTo(-pos.value * 0.1, 1);
    expect((await runTool(ctx, 'what_if', { changes: [{ symbol: 'BA', pct: -50 }] })).result.change).toBe(0);
  });
  it('labels demo output and refuses unknown tickers and invented news', async () => {
    const f = await runTool(ctx, 'forecast', { symbol: 'AAPL', horizon: 'day' });
    expect(f.result).toMatchObject({ real_market_data: false, data_quality: 'simulated', model_confidence: 'low' });
    expect((await runTool(ctx, 'analyze_company', { symbol: 'ZZZZ' })).result.error).toBe('unknown_symbol');
    expect(JSON.stringify((await runTool(ctx, 'get_news', {})).result)).toMatch(/unavailable/);
    const picks = await runTool(ctx, 'stock_picks', { horizon: 'short', count: 5 });
    expect((picks.result.candidates as unknown[]).length).toBe(5);
    expect((await runTool(ctx, 'nope', {})).result.error).toBe('unknown_tool');
  });
  it('reflects executed trades in later analysis', () => {
    const next = executeTrade(data, { side: 'buy', symbol: 'JPM', amount: 5000 }, 200, NOW).data;
    expect(analyzePortfolioData({ ...ctx, data: next }).sectors.some((s) => s.name === 'Financials')).toBe(true);
  });
});

describe('conversation context trimming', () => {
  it('cuts on a plain user message', () => {
    const wire = Array.from({ length: 60 }, (_, i) => (i % 3 === 0 ? { role: 'user', parts: [{ text: `q${i}` }] } : i % 3 === 1 ? { role: 'model', parts: [{ functionCall: {} }] } : { role: 'user', parts: [{ functionResponse: {} }] }));
    const t = trimWire(wire);
    expect(t.length).toBeLessThanOrEqual(40);
    expect(t[0].role).toBe('user');
    expect('text' in t[0].parts[0]).toBe(true);
  });
});
