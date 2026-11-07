import { closeOn, priceAt } from '@/lib/market';
import { DAY, dayNumber } from '@/lib/time';
import { uid } from './ids';
import type { ActivityEntry, AppNotification, Transaction, UserData, UserProfile, UserSettings } from './types';

export const STARTING_BALANCE = 100_000;
export const MAX_ACTIVITY = 300;
export const MAX_NOTIFICATIONS = 60;
const EPS = 1e-9;

export const DEFAULT_SETTINGS: UserSettings = {
  theme: 'light',
  hideBalances: false,
  defaultRange: '1M',
  notifications: {
    tradeConfirmations: true,
    priceAlerts: true,
    priceAlertThreshold: 0.03,
    dailySummary: true,
  },
};

export class TradeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TradeError';
  }
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}
export function round6(n: number) {
  return Math.round(n * 1e6) / 1e6;
}

/* ------------------------------ Construction ----------------------------- */

const SAMPLE_PORTFOLIO: { symbol: string; amount: number; daysAgo: number }[] = [
  { symbol: 'SPY', amount: 18_000, daysAgo: 120 },
  { symbol: 'AAPL', amount: 9_000, daysAgo: 110 },
  { symbol: 'MSFT', amount: 8_000, daysAgo: 95 },
  { symbol: 'NVDA', amount: 7_500, daysAgo: 80 },
  { symbol: 'AMZN', amount: 5_000, daysAgo: 60 },
  { symbol: 'BND', amount: 6_000, daysAgo: 45 },
  { symbol: 'KO', amount: 3_000, daysAgo: 21 },
];

export function createUserData(
  profile: Omit<UserProfile, 'avatarHue' | 'createdAt'> & { createdAt?: number },
  opts: { samplePortfolio?: boolean; now?: number } = {},
): UserData {
  const now = opts.now ?? Date.now();
  const sample = opts.samplePortfolio ?? false;
  const startedAt = sample ? now - 130 * DAY : now;
  let data: UserData = {
    version: 1,
    profile: { ...profile, createdAt: profile.createdAt ?? now, avatarHue: Math.floor(Math.random() * 360) },
    account: { startingBalance: STARTING_BALANCE, cash: STARTING_BALANCE, startedAt },
    holdings: {},
    transactions: [
      { id: uid('tx_'), type: 'deposit', amount: STARTING_BALANCE, cashAfter: STARTING_BALANCE, at: startedAt },
    ],
    watchlist: ['NVDA', 'TSLA', 'GOOGL', 'QQQ'],
    settings: structuredCloneSafe(DEFAULT_SETTINGS),
    activity: [],
    notifications: [],
    alertLog: {},
    updatedAt: now,
  };
  if (sample) {
    for (const s of SAMPLE_PORTFOLIO) {
      const at = now - s.daysAgo * DAY;
      const price = priceAt(s.symbol, at);
      data = executeTrade(data, { side: 'buy', symbol: s.symbol, amount: s.amount }, price, at, { sample: true }).data;
    }
  }
  data = logActivity(data, 'register', `Account created with ${'$'}${STARTING_BALANCE.toLocaleString('en-US')} in virtual funds`, now);
  data = notify(data, {
    title: 'Welcome to ELDAR INVEST',
    body: 'Your virtual account is ready with $100,000 in demo funds. All prices are simulated.',
    tone: 'success',
    href: '/markets',
  }, now);
  return data;
}

function structuredCloneSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** Fill in defaults for data written by older versions of the app. */
export function normalizeUserData(raw: UserData): UserData {
  return {
    ...raw,
    settings: {
      ...DEFAULT_SETTINGS,
      ...raw.settings,
      notifications: { ...DEFAULT_SETTINGS.notifications, ...(raw.settings?.notifications ?? {}) },
    },
    holdings: raw.holdings ?? {},
    transactions: raw.transactions ?? [],
    watchlist: raw.watchlist ?? [],
    activity: raw.activity ?? [],
    notifications: raw.notifications ?? [],
    alertLog: raw.alertLog ?? {},
  };
}

/* --------------------------------- Trades -------------------------------- */

export interface OrderRequest {
  side: 'buy' | 'sell';
  symbol: string;
  /** Either a number of shares… */
  shares?: number;
  /** …or a cash amount in USD. */
  amount?: number;
}

export interface TradeResult {
  data: UserData;
  transaction: Transaction;
}

export function executeTrade(
  data: UserData,
  order: OrderRequest,
  price: number,
  at: number,
  opts: { sample?: boolean } = {},
): TradeResult {
  if (!(price > 0) || !Number.isFinite(price)) throw new TradeError('Price is unavailable. Please try again.');
  let qty: number;
  if (order.shares !== undefined) qty = round6(order.shares);
  else if (order.amount !== undefined) qty = round6(order.amount / price);
  else throw new TradeError('Enter an amount or number of shares.');
  if (!Number.isFinite(qty) || qty <= 0) throw new TradeError('Enter an amount greater than zero.');
  if (qty < 0.0001) throw new TradeError('The minimum order is 0.0001 shares.');

  const existing = data.holdings[order.symbol];
  const holdings = { ...data.holdings };
  let cash = data.account.cash;
  let amount: number;
  let realizedPnl: number | undefined;

  if (order.side === 'buy') {
    amount = order.amount !== undefined && order.shares === undefined ? round2(order.amount) : round2(qty * price);
    if (amount < 1) throw new TradeError('The minimum order value is $1.00.');
    if (amount > cash + EPS) throw new TradeError(`Insufficient virtual funds. Available: $${cash.toFixed(2)}.`);
    cash = round2(cash - amount);
    holdings[order.symbol] = existing
      ? { ...existing, shares: round6(existing.shares + qty), costBasis: round2(existing.costBasis + amount) }
      : { symbol: order.symbol, shares: qty, costBasis: amount, openedAt: at };
  } else {
    if (!existing || existing.shares <= EPS) throw new TradeError(`You don't own any ${order.symbol}.`);
    // Selling (almost) the entire position by amount closes it fully to avoid dust.
    if (qty > existing.shares + EPS) {
      if (order.amount !== undefined && qty - existing.shares < 0.001) qty = existing.shares;
      else throw new TradeError(`You only own ${existing.shares} shares of ${order.symbol}.`);
    }
    if (existing.shares - qty < 0.0001) qty = existing.shares;
    amount = round2(qty * price);
    const avg = existing.costBasis / existing.shares;
    const costPortion = round2(avg * qty);
    realizedPnl = round2(amount - costPortion);
    cash = round2(cash + amount);
    const remaining = round6(existing.shares - qty);
    if (remaining <= EPS) delete holdings[order.symbol];
    else holdings[order.symbol] = { ...existing, shares: remaining, costBasis: round2(existing.costBasis - costPortion) };
  }

  const transaction: Transaction = {
    id: uid('tx_'),
    type: order.side,
    symbol: order.symbol,
    shares: qty,
    price,
    amount,
    realizedPnl,
    cashAfter: cash,
    at,
    ...(opts.sample ? { sample: true } : {}),
  };
  return {
    transaction,
    data: {
      ...data,
      account: { ...data.account, cash },
      holdings,
      transactions: [...data.transactions, transaction].sort((a, b) => a.at - b.at),
      updatedAt: at,
    },
  };
}

/* ------------------------------- Valuation ------------------------------- */

export interface PositionView {
  symbol: string;
  shares: number;
  avgCost: number;
  costBasis: number;
  price: number;
  value: number;
  pnl: number;
  pnlPct: number;
  dayChange: number;
  dayChangePct: number;
  weight: number;
}

export interface PortfolioSummary {
  cash: number;
  invested: number;
  costBasis: number;
  total: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  realizedPnl: number;
  totalReturn: number;
  totalReturnPct: number;
  dayChange: number;
  dayChangePct: number;
  positions: PositionView[];
}

export function summarize(data: UserData, now: number): PortfolioSummary {
  const today = dayNumber(now);
  const positions: PositionView[] = [];
  let invested = 0;
  let costBasis = 0;
  let dayChange = 0;
  let prevValue = 0;
  for (const h of Object.values(data.holdings)) {
    const price = priceAt(h.symbol, now);
    // Positions opened today measure the day move from the purchase price.
    const reference = h.openedAt >= startOfDayTs(now) ? h.costBasis / h.shares : closeOn(h.symbol, today - 1);
    const value = h.shares * price;
    const dc = h.shares * (price - reference);
    invested += value;
    costBasis += h.costBasis;
    dayChange += dc;
    prevValue += h.shares * reference;
    positions.push({
      symbol: h.symbol,
      shares: h.shares,
      avgCost: h.costBasis / h.shares,
      costBasis: h.costBasis,
      price,
      value,
      pnl: value - h.costBasis,
      pnlPct: h.costBasis > 0 ? (value - h.costBasis) / h.costBasis : 0,
      dayChange: dc,
      dayChangePct: reference > 0 ? (price - reference) / reference : 0,
      weight: 0,
    });
  }
  const total = data.account.cash + invested;
  for (const p of positions) p.weight = total > 0 ? p.value / total : 0;
  positions.sort((a, b) => b.value - a.value);
  const realizedPnl = data.transactions.reduce((s, t) => s + (t.at >= data.account.startedAt ? t.realizedPnl ?? 0 : 0), 0);
  const totalReturn = total - data.account.startingBalance;
  return {
    cash: data.account.cash,
    invested,
    costBasis,
    total,
    unrealizedPnl: invested - costBasis,
    unrealizedPnlPct: costBasis > 0 ? (invested - costBasis) / costBasis : 0,
    realizedPnl,
    totalReturn,
    totalReturnPct: totalReturn / data.account.startingBalance,
    dayChange,
    dayChangePct: prevValue + data.account.cash > 0 ? dayChange / (prevValue + data.account.cash) : 0,
    positions,
  };
}

function startOfDayTs(t: number) {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Portfolio value at each timestamp, replaying the transaction log. */
export function portfolioHistory(
  data: UserData,
  grid: number[],
  price: (symbol: string, t: number) => number = priceAt,
): { t: number; v: number }[] {
  const txs = data.transactions.filter((t) => t.at >= data.account.startedAt).sort((a, b) => a.at - b.at);
  const out: { t: number; v: number }[] = [];
  let cash = 0;
  const shares: Record<string, number> = {};
  let i = 0;
  for (const t of grid) {
    while (i < txs.length && txs[i].at <= t) {
      const tx = txs[i];
      cash = tx.cashAfter;
      if (tx.symbol && tx.shares) {
        shares[tx.symbol] = round6((shares[tx.symbol] ?? 0) + (tx.type === 'buy' ? tx.shares : -tx.shares));
        if (shares[tx.symbol] <= EPS) delete shares[tx.symbol];
      }
      i++;
    }
    let v = cash;
    for (const [sym, qty] of Object.entries(shares)) v += qty * price(sym, t);
    out.push({ t, v });
  }
  return out;
}

/* ------------------------ Activity & notifications ----------------------- */

export function logActivity(data: UserData, kind: ActivityEntry['kind'], message: string, at = Date.now()): UserData {
  const entry: ActivityEntry = { id: uid('ac_'), kind, message, at };
  return { ...data, activity: [entry, ...data.activity].slice(0, MAX_ACTIVITY), updatedAt: at };
}

export function notify(
  data: UserData,
  n: Omit<AppNotification, 'id' | 'at' | 'read'>,
  at = Date.now(),
): UserData {
  const entry: AppNotification = { ...n, id: uid('nt_'), at, read: false };
  return { ...data, notifications: [entry, ...data.notifications].slice(0, MAX_NOTIFICATIONS), updatedAt: at };
}

export function resetPortfolio(data: UserData, now = Date.now()): UserData {
  const next: UserData = {
    ...data,
    account: { startingBalance: STARTING_BALANCE, cash: STARTING_BALANCE, startedAt: now },
    holdings: {},
    transactions: [{ id: uid('tx_'), type: 'deposit', amount: STARTING_BALANCE, cashAfter: STARTING_BALANCE, at: now }],
    alertLog: {},
    updatedAt: now,
  };
  return logActivity(next, 'reset', 'Virtual portfolio reset to $100,000', now);
}
