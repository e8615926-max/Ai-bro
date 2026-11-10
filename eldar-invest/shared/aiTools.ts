/**
 * ELDAR AI tool contract — shared by the server (sent to Gemini as function
 * declarations) and the client (which executes the tools and renders cards).
 */
export type AiLang = 'en' | 'ru';
export const AI_RANGES = ['1D', '1W', '1M', '6M', '1Y', '5Y'] as const;
export type AiRange = (typeof AI_RANGES)[number];

export interface ToolDeclaration {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

const sym = { type: 'string', description: 'Ticker symbol in upper case, e.g. TSLA' };
const syms = (min: number, max: number) => ({ type: 'array', items: sym, minItems: min, maxItems: max });

export const AI_TOOLS: ToolDeclaration[] = [
  {
    name: 'show_quotes',
    description: 'Show stock cards with the current price and daily change for 1-6 tickers. Use for price questions.',
    parameters: { type: 'object', properties: { symbols: syms(1, 6) }, required: ['symbols'] },
  },
  {
    name: 'show_chart',
    description:
      'Render an interactive price chart inside the chat. With 2-4 symbols it draws a normalised % comparison. Use the special symbol PORTFOLIO for the user\'s virtual portfolio value.',
    parameters: {
      type: 'object',
      properties: { symbols: syms(1, 4), range: { type: 'string', enum: [...AI_RANGES] } },
      required: ['symbols', 'range'],
    },
  },
  {
    name: 'forecast',
    description:
      'Compute a statistical scenario forecast (bullish / neutral / bearish price ranges, technical indicators, confidence, data quality) for one ticker. ALWAYS use this for any "what could happen / tomorrow / next week / next month / prediction" question. Never state price targets that did not come from this tool.',
    parameters: {
      type: 'object',
      properties: { symbol: sym, horizon: { type: 'string', enum: ['day', 'week', 'month'] } },
      required: ['symbol', 'horizon'],
    },
  },
  {
    name: 'compare',
    description: 'Visual comparison of 2-4 tickers: performance chart plus a side-by-side table of price, returns, risk and financial metrics.',
    parameters: {
      type: 'object',
      properties: { symbols: syms(2, 4), range: { type: 'string', enum: [...AI_RANGES] } },
      required: ['symbols'],
    },
  },
  {
    name: 'analyze_company',
    description:
      'Company intelligence report for one ticker: profile, price, key financial metrics, latest reported financials, earnings history, technical picture and recent news. Use for "analyze X", "is X worth researching", "tell me about X".',
    parameters: { type: 'object', properties: { symbol: sym }, required: ['symbol'] },
  },
  {
    name: 'get_news',
    description: 'Recent financial news with source and publication date. Pass a symbol for company news, omit it for general market news. Use for "why is X falling", "what happened to X", "what news affects the market".',
    parameters: { type: 'object', properties: { symbol: sym } },
  },
  {
    name: 'get_events',
    description: 'Upcoming scheduled earnings reports (next days) that could move stocks. Optional symbol filter.',
    parameters: { type: 'object', properties: { symbol: sym, days: { type: 'integer', minimum: 1, maximum: 14 } } },
  },
  {
    name: 'stock_picks',
    description:
      'Screen the ELDAR INVEST catalogue and return research candidates (not buy recommendations) for an analysis horizon. Use for "which stocks might rise", "show me 5 stocks worth researching", "what looks promising".',
    parameters: {
      type: 'object',
      properties: {
        horizon: { type: 'string', enum: ['short', 'medium', 'long'], description: 'short = days-weeks, medium = months, long = years' },
        count: { type: 'integer', minimum: 1, maximum: 8 },
        kind: { type: 'string', enum: ['any', 'stock', 'etf'] },
      },
      required: ['horizon'],
    },
  },
  {
    name: 'analyze_portfolio',
    description: 'Analyse the user\'s virtual portfolio: allocation, concentration, sector exposure, risk allocation, P&L, strengths, weaknesses and diversification options.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_account',
    description: 'Show the user\'s virtual cash balance, invested value and holdings.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'what_if',
    description: 'Simulate the effect on the virtual portfolio if one or more tickers moved by a given percentage (e.g. Tesla drops 10% => pct = -10).',
    parameters: {
      type: 'object',
      properties: {
        changes: {
          type: 'array',
          minItems: 1,
          maxItems: 5,
          items: { type: 'object', properties: { symbol: sym, pct: { type: 'number' } }, required: ['symbol', 'pct'] },
        },
      },
      required: ['changes'],
    },
  },
  {
    name: 'propose_trade',
    description:
      'Prepare a VIRTUAL buy or sell order and show the user a confirmation card. This never executes the trade: only the user can confirm it with the button on the card. Provide exactly one of amount_usd, shares or fraction (fraction of the current position, sells only; 0.5 = half, 1 = all).',
    parameters: {
      type: 'object',
      properties: {
        side: { type: 'string', enum: ['buy', 'sell'] },
        symbol: sym,
        amount_usd: { type: 'number' },
        shares: { type: 'number' },
        fraction: { type: 'number' },
      },
      required: ['side', 'symbol'],
    },
  },
];

export const AI_TOOL_NAMES = AI_TOOLS.map((t) => t.name);

/** What the backend reports about itself (no secrets). */
export interface BackendStatus {
  ai: { enabled: boolean; provider: string; model: string | null };
  market: {
    quotes: string | null;
    history: string | null;
    fundamentals: string | null;
    news: string | null;
    filings: string | null;
  };
}
