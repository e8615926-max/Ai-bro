import { describe, expect, it } from 'vitest';
import { createUserData, executeTrade, portfolioHistory, resetPortfolio, summarize, TradeError, STARTING_BALANCE } from './account';
import { priceAt, timeGrid } from '@/lib/market';

const NOW = new Date(2026, 10, 7, 15, 30).getTime();
const base = () => createUserData({ uid: 'u1', name: 'Test', email: 't@e.com' }, { now: NOW });

describe('trading engine', () => {
  it('starts with the virtual balance', () => {
    const d = base();
    expect(d.account.cash).toBe(STARTING_BALANCE);
    expect(summarize(d, NOW).total).toBeCloseTo(STARTING_BALANCE, 6);
  });

  it('buys by amount and updates cash and holdings', () => {
    const p = priceAt('AAPL', NOW);
    const { data, transaction } = executeTrade(base(), { side: 'buy', symbol: 'AAPL', amount: 1000 }, p, NOW);
    expect(data.account.cash).toBe(99_000);
    expect(data.holdings.AAPL.shares).toBeCloseTo(1000 / p, 5);
    expect(transaction.amount).toBe(1000);
    expect(summarize(data, NOW).total).toBeCloseTo(STARTING_BALANCE, 0);
  });

  it('buys by shares', () => {
    const { data } = executeTrade(base(), { side: 'buy', symbol: 'KO', shares: 10 }, 50, NOW);
    expect(data.account.cash).toBe(99_500);
    expect(data.holdings.KO.shares).toBe(10);
    expect(data.holdings.KO.costBasis).toBe(500);
  });

  it('rejects orders over the available balance', () => {
    expect(() => executeTrade(base(), { side: 'buy', symbol: 'KO', amount: 100_001 }, 50, NOW)).toThrow(TradeError);
  });

  it('rejects selling what you do not own', () => {
    expect(() => executeTrade(base(), { side: 'sell', symbol: 'KO', shares: 1 }, 50, NOW)).toThrow(/don't own/);
  });

  it('sells with average-cost realised P&L', () => {
    let d = executeTrade(base(), { side: 'buy', symbol: 'KO', shares: 10 }, 50, NOW).data;
    d = executeTrade(d, { side: 'buy', symbol: 'KO', shares: 10 }, 70, NOW + 1).data; // avg 60
    const r = executeTrade(d, { side: 'sell', symbol: 'KO', shares: 5 }, 80, NOW + 2);
    expect(r.transaction.realizedPnl).toBe(100);
    expect(r.data.holdings.KO.shares).toBe(15);
    expect(r.data.holdings.KO.costBasis).toBe(900);
    expect(r.data.account.cash).toBe(100_000 - 500 - 700 + 400);
  });

  it('closes the position fully when selling everything', () => {
    let d = executeTrade(base(), { side: 'buy', symbol: 'KO', amount: 333.33 }, 61.7, NOW).data;
    const all = d.holdings.KO.shares;
    d = executeTrade(d, { side: 'sell', symbol: 'KO', shares: all }, 61.7, NOW + 1).data;
    expect(d.holdings.KO).toBeUndefined();
  });

  it('rejects zero and negative orders', () => {
    expect(() => executeTrade(base(), { side: 'buy', symbol: 'KO', amount: 0 }, 50, NOW)).toThrow();
    expect(() => executeTrade(base(), { side: 'buy', symbol: 'KO', shares: -2 }, 50, NOW)).toThrow();
  });

  it('replays history consistently with the current summary', () => {
    const d = createUserData({ uid: 'u2', name: 'S', email: 's@e.com' }, { now: NOW, samplePortfolio: true });
    const grid = timeGrid('3M', NOW, d.account.startedAt);
    const hist = portfolioHistory(d, grid);
    expect(hist[hist.length - 1].v).toBeCloseTo(summarize(d, NOW).total, 4);
    expect(d.transactions.filter((t) => t.sample).length).toBeGreaterThan(3);
  });

  it('resets the portfolio', () => {
    let d = executeTrade(base(), { side: 'buy', symbol: 'KO', shares: 10 }, 50, NOW).data;
    d = resetPortfolio(d, NOW + 5);
    expect(d.account.cash).toBe(STARTING_BALANCE);
    expect(Object.keys(d.holdings)).toHaveLength(0);
  });
});
