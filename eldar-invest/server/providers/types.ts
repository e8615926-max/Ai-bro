/**
 * Provider-neutral market data shapes. Every payload carries `source` and
 * `asOf` so the UI can always show where a number came from and how old it is.
 * To switch vendors, implement these functions in a new adapter and register
 * it in server/market.ts — nothing else changes.
 */
export interface Sourced {
  source: string;
  asOf: number;
}

export interface QuoteDTO extends Sourced {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  open: number | null;
  high: number | null;
  low: number | null;
  prevClose: number;
}

export interface HistoryDTO extends Sourced {
  symbol: string;
  interval: string;
  points: { t: number; v: number }[];
}

export interface ProfileDTO extends Sourced {
  symbol: string;
  name: string;
  logo: string | null;
  industry: string | null;
  exchange: string | null;
  country: string | null;
  currency: string | null;
  marketCap: number | null;
  ipo: string | null;
  website: string | null;
}

export interface EarningsRow {
  period: string;
  actual: number | null;
  estimate: number | null;
  surprisePct: number | null;
}

export interface MetricsDTO extends Sourced {
  symbol: string;
  pe: number | null;
  eps: number | null;
  beta: number | null;
  high52: number | null;
  low52: number | null;
  ret5d: number | null;
  ret13w: number | null;
  ret26w: number | null;
  ret52w: number | null;
  revenueGrowth: number | null;
  epsGrowth: number | null;
  netMargin: number | null;
  grossMargin: number | null;
  roe: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  dividendYield: number | null;
  earnings: EarningsRow[];
}

export interface FilingsDTO extends Sourced {
  symbol: string;
  fiscalYear: number;
  periodEnd: string;
  form: string;
  revenue: number | null;
  revenuePrev: number | null;
  netIncome: number | null;
  netIncomePrev: number | null;
  assets: number | null;
  liabilities: number | null;
  equity: number | null;
  cash: number | null;
  longTermDebt: number | null;
}

export interface NewsDTO {
  headline: string;
  source: string;
  url: string;
  publishedAt: number;
  summary: string;
  related: string | null;
}

export interface EventDTO {
  symbol: string;
  date: string;
  hour: string | null;
  epsEstimate: number | null;
  revenueEstimate: number | null;
}
