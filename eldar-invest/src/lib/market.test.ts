import { describe, expect, it } from 'vitest';
import { ASSETS } from '@/data/assets';
import { assetSeries, closeOn, getDayStats, getQuote, priceAt, RANGES, timeGrid } from './market';
import { dayNumber, DAY } from './time';

const NOW = new Date(2026, 10, 7, 15, 30, 12).getTime();

describe('market simulator', () => {
  it('is deterministic', () => {
    expect(priceAt('AAPL', NOW)).toBe(priceAt('AAPL', NOW));
    expect(closeOn('MSFT', dayNumber(NOW) - 10)).toBe(closeOn('MSFT', dayNumber(NOW) - 10));
  });

  it('produces positive, finite prices for every asset and range', () => {
    for (const a of ASSETS) {
      const q = getQuote(a.symbol, NOW);
      expect(q.price).toBeGreaterThan(0);
      expect(Number.isFinite(q.changePct)).toBe(true);
      for (const r of RANGES) {
        const s = assetSeries(a.symbol, r, NOW);
        expect(s.length).toBeGreaterThan(1);
        expect(s.every((p) => p.v > 0 && Number.isFinite(p.v))).toBe(true);
      }
    }
  });

  it('is continuous across day boundaries', () => {
    const d = dayNumber(NOW) - 3;
    const close = closeOn('NVDA', d);
    const next = new Date(new Date(NOW - 3 * DAY).setHours(24, 0, 0, 0)).getTime();
    expect(priceAt('NVDA', next - 1)).toBeCloseTo(close, 0);
    expect(priceAt('NVDA', next)).toBeCloseTo(close, 6);
  });

  it('keeps prices in a plausible band around the reference', () => {
    for (const a of ASSETS) {
      const p = priceAt(a.symbol, NOW);
      expect(p / a.refPrice).toBeGreaterThan(0.4);
      expect(p / a.refPrice).toBeLessThan(2.5);
    }
  });

  it('has sorted, ending-at-now grids', () => {
    for (const r of RANGES) {
      const g = timeGrid(r, NOW);
      expect(g[g.length - 1]).toBe(NOW);
      for (let i = 1; i < g.length; i++) expect(g[i]).toBeGreaterThan(g[i - 1]);
    }
  });

  it('computes day stats within bounds', () => {
    const s = getDayStats('TSLA', NOW);
    const p = priceAt('TSLA', NOW);
    expect(s.high).toBeGreaterThanOrEqual(p);
    expect(s.low).toBeLessThanOrEqual(p);
    expect(s.high52).toBeGreaterThanOrEqual(s.high);
  });
});
