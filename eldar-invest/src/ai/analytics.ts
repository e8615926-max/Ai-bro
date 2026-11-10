/**
 * Pure analytics for ELDAR AI: technical indicators, scenario forecasts and
 * candidate screening. Everything here is deterministic arithmetic on the
 * price history it is given — no language model is involved, so no number
 * can be "hallucinated".
 */
import type { Forecast, Indicators, Meta, Pt, Scenario, Signal } from './types';

const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const stdev = (a: number[]) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
};
const sma = (v: number[], n: number) => (v.length >= n ? mean(v.slice(-n)) : null);
const ret = (v: number[], n: number) => (v.length > n ? v[v.length - 1] / v[v.length - 1 - n] - 1 : null);
export const pctStr = (x: number, digits = 1) => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(digits)}%`;

export function rsi(values: number[], period = 14): number | null {
  if (values.length <= period) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  gain /= period;
  loss /= period;
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    gain = (gain * (period - 1) + Math.max(d, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (loss === 0) return 100;
  return 100 - 100 / (1 + gain / loss);
}

export function logReturns(values: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < values.length; i++) out.push(Math.log(values[i] / values[i - 1]));
  return out;
}

/** `daily` = daily closes, oldest first. `price` = latest price (may be intraday). */
export function indicators(daily: Pt[], price: number): Indicators {
  const v = daily.map((p) => p.v);
  if (v.length && Math.abs(v[v.length - 1] - price) / price > 1e-9) v.push(price);
  const year = v.slice(-252);
  const high52 = Math.max(...year);
  const low52 = Math.min(...year);
  let peak = year[0];
  let dd = 0;
  for (const x of year) {
    peak = Math.max(peak, x);
    dd = Math.min(dd, x / peak - 1);
  }
  return {
    price,
    sma20: sma(v, 20),
    sma50: sma(v, 50),
    sma200: sma(v, 200),
    rsi14: rsi(v.slice(-120)),
    ret1m: ret(v, 21),
    ret3m: ret(v, 63),
    ret1y: ret(v, 252),
    volAnnual: stdev(logReturns(year)) * Math.sqrt(252),
    high52,
    low52,
    pos52: high52 > low52 ? (price - low52) / (high52 - low52) : 0.5,
    maxDrawdown: dd,
    days: daily.length,
  };
}

const HORIZON_DAYS = { day: 1, week: 5, month: 21 } as const;

/** Standard normal CDF (Abramowitz–Stegun approximation). */
function cdf(x: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

/** Trend score in [-1, 1] from simple, widely used technical signals. */
export function trendSignals(ind: Indicators): { score: number; signals: Signal[] } {
  const signals: Signal[] = [];
  let score = 0;
  const p = ind.price;
  if (ind.sma50 !== null) {
    const up = p > ind.sma50;
    score += up ? 0.25 : -0.25;
    signals.push({ key: up ? 'sig.aboveSma50' : 'sig.belowSma50', tone: up ? 'up' : 'down', params: { v: ind.sma50.toFixed(2) } });
  }
  if (ind.sma200 !== null) {
    const up = p > ind.sma200;
    score += up ? 0.25 : -0.25;
    signals.push({ key: up ? 'sig.aboveSma200' : 'sig.belowSma200', tone: up ? 'up' : 'down', params: { v: ind.sma200.toFixed(2) } });
  }
  if (ind.ret1m !== null) {
    const tone = ind.ret1m > 0.02 ? 'up' : ind.ret1m < -0.02 ? 'down' : 'flat';
    score += tone === 'up' ? 0.25 : tone === 'down' ? -0.25 : 0;
    signals.push({ key: 'sig.momentum1m', tone, params: { v: pctStr(ind.ret1m) } });
  }
  if (ind.rsi14 !== null) {
    const r = ind.rsi14;
    const key = r >= 70 ? 'sig.rsiHigh' : r <= 30 ? 'sig.rsiLow' : 'sig.rsiMid';
    // Overbought readings temper bullishness; oversold readings temper bearishness.
    score += r >= 70 ? -0.15 : r <= 30 ? 0.15 : 0;
    signals.push({ key, tone: r >= 70 ? 'down' : r <= 30 ? 'up' : 'flat', params: { v: r.toFixed(0) } });
  }
  signals.push({ key: 'sig.pos52', tone: 'flat', params: { v: (ind.pos52 * 100).toFixed(0) } });
  return { score: Math.max(-1, Math.min(1, score)), signals };
}

/**
 * Scenario forecast from historical volatility.
 *
 * The horizon's return is modelled as normal with standard deviation
 * sigma_daily * sqrt(days) and a heavily shrunk historical drift. Scenarios are
 * bands of that distribution; technical signals may tilt the bull/bear odds
 * by at most ±6 points. This describes uncertainty — it is not a prediction.
 */
export function buildForecast(input: { symbol: string; name: string; horizon: Forecast['horizon']; daily: Pt[]; price: number; meta: Meta; earningsSoon?: string | null }): Forecast | null {
  const { daily, price, horizon } = input;
  if (daily.length < 40) return null;
  const ind = indicators(daily, price);
  const rets = logReturns(daily.map((p) => p.v).slice(-252));
  const h = HORIZON_DAYS[horizon];
  const sd = Math.max(stdev(rets), 1e-4) * Math.sqrt(h);
  const mu = Math.max(-0.0015, Math.min(0.0015, mean(rets) * 0.25)) * h;
  const at = (z: number) => price * Math.exp(mu + z * sd);
  const { score, signals } = trendSignals(ind);
  const tilt = score * 0.06;
  const pNeutral = cdf(0.5) - cdf(-0.5);
  const side = (1 - pNeutral) / 2;
  const scenarios: Scenario[] = [
    { kind: 'bull', low: at(0.5), high: at(1.65), probability: side + tilt },
    { kind: 'neutral', low: at(-0.5), high: at(0.5), probability: pNeutral },
    { kind: 'bear', low: at(-1.65), high: at(-0.5), probability: side - tilt },
  ];
  const risks: Signal[] = [];
  if (ind.volAnnual > 0.4) risks.push({ key: 'risk.highVol', tone: 'down', params: { v: (ind.volAnnual * 100).toFixed(0) } });
  else risks.push({ key: 'risk.vol', tone: 'flat', params: { v: (ind.volAnnual * 100).toFixed(0) } });
  if (ind.maxDrawdown < -0.2) risks.push({ key: 'risk.drawdown', tone: 'down', params: { v: (Math.abs(ind.maxDrawdown) * 100).toFixed(0) } });
  if (input.earningsSoon) risks.push({ key: 'risk.earnings', tone: 'down', params: { v: input.earningsSoon } });
  risks.push({ key: 'risk.news', tone: 'flat', params: {} });
  risks.push({ key: input.meta.real ? 'risk.model' : 'risk.simulated', tone: 'flat', params: {} });
  const quality: Forecast['quality'] = !input.meta.real ? 'simulated' : daily.length >= 200 ? 'good' : 'limited';
  return {
    symbol: input.symbol,
    name: input.name,
    horizon,
    price,
    rangeLow: at(-1.28),
    rangeHigh: at(1.28),
    scenarios,
    signals,
    risks,
    // Short horizons with a full year of real data are the best case, and even that is only "medium".
    confidence: quality === 'good' && horizon !== 'month' ? 'medium' : 'low',
    quality,
    indicators: ind,
    meta: input.meta,
  };
}

/* -------------------------------- Screening ------------------------------- */

export interface ScreenRow {
  symbol: string;
  ret5d: number | null;
  ret13w: number | null;
  ret26w: number | null;
  ret52w: number | null;
  /** Risk proxy: beta (real data) or annualised volatility (simulator). */
  risk: number | null;
  pos52: number | null;
  pe: number | null;
  revenueGrowth: number | null;
  epsGrowth: number | null;
  netMargin: number | null;
  roe: number | null;
  debtToEquity: number | null;
}

type Factor = keyof Omit<ScreenRow, 'symbol'>;

/** Factor weights per horizon. Negative weight = lower is better. */
export const HORIZON_WEIGHTS: Record<'short' | 'medium' | 'long', Partial<Record<Factor, number>>> = {
  short: { ret5d: 1, ret13w: 2, pos52: 1, risk: -0.5 },
  medium: { ret13w: 1, ret26w: 2, ret52w: 1, revenueGrowth: 1.5, epsGrowth: 1, risk: -0.5 },
  long: { roe: 2, netMargin: 1.5, revenueGrowth: 1.5, debtToEquity: -1, pe: -1, ret52w: 0.5, risk: -0.5 },
};

export interface Scored {
  row: ScreenRow;
  score: number;
  /** Factors ordered from most helpful to most harmful, with percentile 0..1. */
  factors: { factor: Factor; pct: number; contribution: number }[];
}

/** Percentile-rank each factor across the universe and blend by horizon weights. */
export function scoreUniverse(rows: ScreenRow[], horizon: 'short' | 'medium' | 'long'): Scored[] {
  const weights = HORIZON_WEIGHTS[horizon];
  const factors = Object.keys(weights) as Factor[];
  const ranks = new Map<Factor, Map<string, number>>();
  for (const f of factors) {
    const have = rows.filter((r) => r[f] !== null && Number.isFinite(r[f] as number)).sort((a, b) => (a[f] as number) - (b[f] as number));
    const m = new Map<string, number>();
    have.forEach((r, i) => m.set(r.symbol, have.length > 1 ? i / (have.length - 1) : 0.5));
    ranks.set(f, m);
  }
  return rows
    .map((row) => {
      let total = 0;
      let weightSum = 0;
      const parts: Scored['factors'] = [];
      for (const f of factors) {
        const pct = ranks.get(f)!.get(row.symbol);
        if (pct === undefined) continue;
        const w = weights[f]!;
        const goodness = w > 0 ? pct : 1 - pct;
        total += goodness * Math.abs(w);
        weightSum += Math.abs(w);
        parts.push({ factor: f, pct, contribution: (goodness - 0.5) * Math.abs(w) });
      }
      // Require at least two factors so a single data point can't crown a pick.
      const score = parts.length >= 2 ? total / weightSum : 0;
      return { row, score, factors: parts.sort((a, b) => b.contribution - a.contribution) };
    })
    .sort((a, b) => b.score - a.score);
}
