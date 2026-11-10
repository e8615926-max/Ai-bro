import type { AiLang, AiRange } from '@shared/aiTools';
import type { Transaction } from '@/domain/types';

export type { AiLang, AiRange };

/** Where a figure came from. Rendered on every card. */
export interface Meta {
  source: string;
  /** false = ELDAR INVEST simulator (demo data). */
  real: boolean;
  asOf: number;
}

export interface QuoteInfo {
  symbol: string;
  name: string;
  logo: string | null;
  price: number;
  change: number;
  changePct: number;
  prevClose: number;
  high: number | null;
  low: number | null;
  meta: Meta;
}

export interface Pt {
  t: number;
  v: number;
}

export interface Series {
  key: string;
  label: string;
  points: Pt[];
}

export interface Indicators {
  price: number;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  rsi14: number | null;
  ret1m: number | null;
  ret3m: number | null;
  ret1y: number | null;
  volAnnual: number;
  high52: number;
  low52: number;
  pos52: number;
  maxDrawdown: number;
  days: number;
}

export interface Scenario {
  kind: 'bull' | 'neutral' | 'bear';
  low: number;
  high: number;
  probability: number;
}

export type Signal = { key: string; tone: 'up' | 'down' | 'flat'; params: Record<string, string> };

export interface Forecast {
  symbol: string;
  name: string;
  horizon: 'day' | 'week' | 'month';
  price: number;
  rangeLow: number;
  rangeHigh: number;
  scenarios: Scenario[];
  signals: Signal[];
  risks: Signal[];
  confidence: 'low' | 'medium';
  quality: 'simulated' | 'good' | 'limited';
  indicators: Indicators;
  meta: Meta;
}

export interface Fundamentals {
  pe: number | null;
  eps: number | null;
  beta: number | null;
  revenueGrowth: number | null;
  epsGrowth: number | null;
  netMargin: number | null;
  grossMargin: number | null;
  roe: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  dividendYield: number | null;
  ret13w: number | null;
  ret52w: number | null;
  earnings: { period: string; actual: number | null; estimate: number | null; surprisePct: number | null }[];
  meta: Meta;
}

export interface Filings {
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
  meta: Meta;
}

export interface Profile {
  name: string;
  logo: string | null;
  industry: string | null;
  exchange: string | null;
  country: string | null;
  marketCap: number | null;
  ipo: string | null;
  website: string | null;
  description: string | null;
  meta: Meta;
}

export interface NewsItem {
  headline: string;
  source: string;
  url: string;
  publishedAt: number;
  summary: string;
  related: string | null;
}

export interface EventItem {
  symbol: string;
  date: string;
  hour: string | null;
  epsEstimate: number | null;
}

export interface CompanyReport {
  symbol: string;
  quote: QuoteInfo;
  profile: Profile;
  indicators: Indicators | null;
  fundamentals: Fundamentals | null;
  filings: Filings | null;
  news: NewsItem[] | null;
  /** Human-readable list of data that could not be loaded. */
  missing: string[];
  owned: { shares: number; value: number; pnlPct: number } | null;
}

export interface Pick {
  symbol: string;
  name: string;
  logo: string | null;
  kind: 'stock' | 'etf';
  category: string;
  overview: string;
  price: number;
  changePct: number;
  score: number;
  reasons: Signal[];
  opportunities: Signal[];
  risks: Signal[];
  metrics: { key: string; value: string }[];
  ownedWeight: number | null;
  meta: Meta;
  sources: string[];
}

export interface PortfolioAnalysis {
  total: number;
  cash: number;
  invested: number;
  cashWeight: number;
  totalReturn: number;
  totalReturnPct: number;
  dayChange: number;
  unrealizedPnl: number;
  realizedPnl: number;
  positions: { symbol: string; name: string; value: number; weight: number; pnl: number; pnlPct: number; shares: number; avgCost: number; riskShare: number; vol: number }[];
  sectors: { name: string; weight: number }[];
  hhi: number;
  concentration: 'low' | 'moderate' | 'high';
  portfolioVol: number;
  strengths: Signal[];
  weaknesses: Signal[];
  ideas: Signal[];
  trades: number;
  meta: Meta;
}

export interface WhatIf {
  changes: { symbol: string; pct: number; held: boolean; value: number; impact: number }[];
  before: number;
  after: number;
  delta: number;
  deltaPct: number;
  meta: Meta;
}

export interface TradeProposal {
  id: string;
  side: 'buy' | 'sell';
  symbol: string;
  name: string;
  /** Exactly one of these defines the order. */
  amount?: number;
  shares?: number;
  estPrice: number;
  estShares: number;
  estTotal: number;
  cashAfter: number;
  status: 'pending' | 'executing' | 'done' | 'cancelled' | 'failed';
  result?: Transaction;
  error?: string;
  createdAt: number;
}

export interface MetricsTable {
  columns: { symbol: string; name: string }[];
  rows: { key: string; values: (string | null)[]; best?: number }[];
  meta: Meta;
  note?: string;
}

export type Block =
  | { type: 'text'; text: string }
  | { type: 'notice'; tone: 'info' | 'warning' | 'error'; text: string }
  | { type: 'quotes'; items: QuoteInfo[] }
  | { type: 'chart'; id: string; symbols: string[]; range: AiRange; series: Series[]; normalized: boolean; meta: Meta }
  | { type: 'metrics'; table: MetricsTable }
  | { type: 'forecast'; data: Forecast }
  | { type: 'company'; data: CompanyReport }
  | { type: 'news'; title: string; items: NewsItem[]; meta: Meta }
  | { type: 'events'; items: EventItem[]; meta: Meta }
  | { type: 'picks'; horizon: 'short' | 'medium' | 'long'; items: Pick[] }
  | { type: 'portfolio'; data: PortfolioAnalysis }
  | { type: 'account'; total: number; cash: number; invested: number; positions: { symbol: string; value: number; shares: number }[]; meta: Meta }
  | { type: 'whatif'; data: WhatIf }
  | { type: 'trade'; proposal: TradeProposal };

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  blocks: Block[];
  at: number;
  /** Which engine produced the answer. */
  engine?: 'gemini' | 'local';
  suggestions?: string[];
}

/** Gemini wire format, kept verbatim (including thought signatures). */
export interface WireContent {
  role: 'user' | 'model';
  parts: Record<string, unknown>[];
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  wire: WireContent[];
  focus: string[];
  lang: AiLang;
}

export interface ToolOutput {
  blocks: Block[];
  /** Compact facts for the language model. */
  result: Record<string, unknown>;
  focus?: string[];
  /** Plain-language summary used by the built-in analyst. */
  summary: string;
  suggestions?: string[];
}
