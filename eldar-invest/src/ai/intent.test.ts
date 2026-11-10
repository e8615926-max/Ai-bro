import { describe, expect, it } from 'vitest';
import { parseIntent } from './intent';
import { findSymbols } from './symbols';

const p = (m: string, focus: string[] = []) => parseIntent(m, focus);

describe('symbol detection', () => {
  it('finds names and tickers in English and Russian', () => {
    expect(findSymbols('Compare Tesla and NVIDIA')).toEqual(['TSLA', 'NVDA']);
    expect(findSymbols('Сравни Теслу и Нвидиа')).toEqual(['TSLA', 'NVDA']);
    expect(findSymbols('что с эпл и майкрософт?')).toEqual(['AAPL', 'MSFT']);
    expect(findSymbols('buy AAPL and $V')).toEqual(['AAPL', 'V']);
  });
  it('does not mistake ordinary words for tickers', () => {
    expect(findSymbols('what can i do about a cat?')).toEqual([]);
    expect(findSymbols('Which stocks might rise next week?')).toEqual([]);
    expect(findSymbols('Какие акции могут вырасти?')).toEqual([]);
  });
});

describe('intent parsing', () => {
  it.each([
    ['What could happen to Tesla tomorrow?', { tool: 'forecast', args: { symbol: 'TSLA', horizon: 'day' } }],
    ['Что может случиться с Теслой завтра?', { tool: 'forecast', args: { symbol: 'TSLA', horizon: 'day' } }],
    ['What could happen to Apple over the next month?', { tool: 'forecast', args: { symbol: 'AAPL', horizon: 'month' } }],
    ['Analyze NVIDIA', { tool: 'analyze_company', args: { symbol: 'NVDA' } }],
    ['Is NVIDIA worth researching right now?', { tool: 'analyze_company', args: { symbol: 'NVDA' } }],
    ['Проанализируй Нвидиа', { tool: 'analyze_company', args: { symbol: 'NVDA' } }],
    ['Compare Tesla and NVIDIA', { tool: 'compare', args: { symbols: ['TSLA', 'NVDA'], range: undefined } }],
    ['Why is Tesla falling today?', { tool: 'get_news', args: { symbol: 'TSLA' } }],
    ['What news is affecting the market?', { tool: 'get_news', args: { symbol: undefined } }],
    ['Analyze my portfolio', { tool: 'analyze_portfolio', args: {} }],
    ['Проанализируй мой портфель', { tool: 'analyze_portfolio', args: {} }],
    ['How much virtual cash do I have left?', { tool: 'get_account', args: {} }],
    ['Сколько у меня осталось денег?', { tool: 'get_account', args: {} }],
    ['Buy $500 of Tesla', { tool: 'propose_trade', args: { side: 'buy', symbol: 'TSLA', amount_usd: 500 } }],
    ['Купи Теслу на 500 долларов', { tool: 'propose_trade', args: { side: 'buy', symbol: 'TSLA', amount_usd: 500 } }],
    ['Sell half of my NVIDIA shares', { tool: 'propose_trade', args: { side: 'sell', symbol: 'NVDA', fraction: 0.5 } }],
    ['Продай половину Нвидиа', { tool: 'propose_trade', args: { side: 'sell', symbol: 'NVDA', fraction: 0.5 } }],
    ['Buy 3 shares of Apple', { tool: 'propose_trade', args: { side: 'buy', symbol: 'AAPL', shares: 3 } }],
    ['Show me a 1Y chart of Microsoft', { tool: 'show_chart', args: { symbols: ['MSFT'], range: '1Y' } }],
    ['Покажи график Apple за 5 лет', { tool: 'show_chart', args: { symbols: ['AAPL'], range: '5Y' } }],
  ])('%s', (msg, expected) => {
    expect(p(msg as string)).toEqual(expected);
  });

  it('routes open questions to stock picks with a horizon', () => {
    expect(p('Which stocks might rise next week?')).toMatchObject({ tool: 'stock_picks', args: { horizon: 'short' } });
    expect(p('Show me 5 stocks worth researching right now.')).toMatchObject({ tool: 'stock_picks', args: { count: 5 } });
    expect(p('Which companies currently look promising?')).toMatchObject({ tool: 'stock_picks' });
    expect(p('Какие акции перспективны в долгосрочной перспективе?')).toMatchObject({ tool: 'stock_picks', args: { horizon: 'long' } });
  });

  it('treats hypotheticals as simulations, never as orders', () => {
    expect(p('What would happen to my portfolio if Tesla dropped by 10%?')).toEqual({ tool: 'what_if', args: { changes: [{ symbol: 'TSLA', pct: -10 }] } });
    expect(p('Что будет с портфелем, если Тесла упадёт на 10%?')).toEqual({ tool: 'what_if', args: { changes: [{ symbol: 'TSLA', pct: -10 }] } });
    expect(p('Should I buy Tesla?').tool).not.toBe('propose_trade');
  });

  it('keeps conversation context', () => {
    expect(p('What about tomorrow?', ['AAPL'])).toEqual({ tool: 'forecast', args: { symbol: 'AAPL', horizon: 'day' } });
    expect(p('А что завтра?', ['AAPL'])).toEqual({ tool: 'forecast', args: { symbol: 'AAPL', horizon: 'day' } });
    expect(p('Compare it with Microsoft', ['AAPL'])).toMatchObject({ tool: 'compare', args: { symbols: ['AAPL', 'MSFT'] } });
    expect(p('Сравни с Майкрософт', ['AAPL'])).toMatchObject({ tool: 'compare', args: { symbols: ['AAPL', 'MSFT'] } });
    expect(p('Buy $200 of it', ['AAPL'])).toMatchObject({ tool: 'propose_trade', args: { symbol: 'AAPL', amount_usd: 200 } });
  });

  it('asks for missing details instead of guessing', () => {
    expect(p('Buy Tesla')).toEqual({ tool: 'help', args: { reason: 'need_amount' } });
    expect(p('Sell everything now')).toEqual({ tool: 'help', args: { reason: 'need_symbol' } });
  });
});
