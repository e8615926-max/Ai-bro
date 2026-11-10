/**
 * SEC EDGAR adapter (https://www.sec.gov/edgar/sec-api-documentation).
 * Official U.S. government data: free, no API key, public information.
 * SEC asks automated clients to identify themselves with a User-Agent that
 * includes contact details (set SEC_USER_AGENT) and to stay under 10 req/s.
 * Covers companies that file 10-K reports in US-GAAP; foreign filers
 * (20-F / IFRS) and ETFs are reported as unavailable rather than guessed.
 */
import { cached, env, HttpError, upstream } from '../http.js';
import type { FilingsDTO } from './types.js';

const NAME = 'SEC EDGAR';
export const edgarEnabled = () => env('SEC_EDGAR') !== 'off';
const headers = () => ({ 'User-Agent': env('SEC_USER_AGENT') ?? 'ELDAR-INVEST research app (set SEC_USER_AGENT with contact email)', Accept: 'application/json' });
const filesBase = () => env('SEC_FILES_BASE') ?? 'https://www.sec.gov';
const dataBase = () => env('SEC_DATA_BASE') ?? 'https://data.sec.gov';

function cikFor(symbol: string): Promise<string | null> {
  return cached('sec:tickers', 24 * 3600_000, async () => {
    const d = (await upstream(NAME, `${filesBase()}/files/company_tickers.json`, { headers: headers() })) as Record<string, { cik_str: number; ticker: string }>;
    const map: Record<string, string> = {};
    for (const row of Object.values(d)) map[String(row.ticker).toUpperCase()] = String(row.cik_str).padStart(10, '0');
    return map;
  }).then((map) => map[symbol.replace('.', '-')] ?? null);
}

interface Fact {
  end: string;
  start?: string;
  val: number;
  fy: number;
  fp: string;
  form: string;
  filed: string;
}
type Facts = Record<string, { units?: Record<string, Fact[]> }>;

const days = (f: Fact) => (f.start ? (Date.parse(f.end) - Date.parse(f.start)) / 86400_000 : 0);

/** Latest full-year value for the first tag that has data, plus the prior year. */
function annual(facts: Facts, tags: string[], periodEnd?: string): { cur: Fact; prev: Fact | null } | null {
  let best: { cur: Fact; prev: Fact | null } | null = null;
  for (const tag of tags) {
    const rows = (facts[tag]?.units?.USD ?? []).filter((f) => f.form === '10-K' && days(f) > 340 && days(f) < 380);
    if (!rows.length) continue;
    const byEnd = new Map<string, Fact>();
    for (const r of rows) {
      const prev = byEnd.get(r.end);
      if (!prev || r.filed > prev.filed) byEnd.set(r.end, r);
    }
    const sorted = [...byEnd.values()].sort((a, b) => (a.end < b.end ? 1 : -1));
    const cur = periodEnd ? sorted.find((f) => f.end === periodEnd) : sorted[0];
    if (!cur) continue;
    const prev = sorted.find((f) => f.end < cur.end) ?? null;
    if (!best || cur.end > best.cur.end) best = { cur, prev };
  }
  return best;
}

/** Latest balance-sheet (instant) value at a given period end. */
function instant(facts: Facts, tags: string[], periodEnd: string): number | null {
  for (const tag of tags) {
    const hit = (facts[tag]?.units?.USD ?? []).filter((f) => f.end === periodEnd && !f.start).sort((a, b) => (a.filed < b.filed ? 1 : -1))[0];
    if (hit) return hit.val;
  }
  return null;
}

export function filings(symbol: string): Promise<FilingsDTO | null> {
  return cached(`sec:f:${symbol}`, 12 * 3600_000, async () => {
    const cik = await cikFor(symbol);
    if (!cik) return null;
    let d: { facts?: { 'us-gaap'?: Facts } };
    try {
      d = (await upstream(NAME, `${dataBase()}/api/xbrl/companyfacts/CIK${cik}.json`, { headers: headers() }, 20_000)) as typeof d;
    } catch (e) {
      if (e instanceof HttpError && e.code === 'upstream_error') return null;
      throw e;
    }
    const gaap = d.facts?.['us-gaap'];
    if (!gaap) return null;
    const revenue = annual(gaap, ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet', 'RevenuesNetOfInterestExpense']);
    const income = annual(gaap, ['NetIncomeLoss', 'ProfitLoss'], revenue?.cur.end) ?? annual(gaap, ['NetIncomeLoss', 'ProfitLoss']);
    const anchor = revenue?.cur ?? income?.cur;
    if (!anchor) return null;
    return {
      symbol,
      fiscalYear: Number(anchor.end.slice(0, 4)),
      periodEnd: anchor.end,
      form: anchor.form,
      revenue: revenue?.cur.val ?? null,
      revenuePrev: revenue?.prev?.val ?? null,
      netIncome: income?.cur.val ?? null,
      netIncomePrev: income?.prev?.val ?? null,
      assets: instant(gaap, ['Assets'], anchor.end),
      liabilities: instant(gaap, ['Liabilities'], anchor.end),
      equity: instant(gaap, ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'], anchor.end),
      cash: instant(gaap, ['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents'], anchor.end),
      longTermDebt: instant(gaap, ['LongTermDebtNoncurrent', 'LongTermDebt', 'LongTermDebtAndCapitalLeaseObligations'], anchor.end),
      source: `${NAME} (Form ${anchor.form})`,
      asOf: Date.parse(anchor.filed),
    };
  });
}

export const EDGAR_NAME = NAME;
