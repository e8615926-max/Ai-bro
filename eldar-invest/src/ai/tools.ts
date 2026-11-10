/**
 * ELDAR AI tool executors. Each tool gathers data through the active
 * ResearchProvider and the user's virtual account, then returns:
 *   - blocks      → rich cards and charts rendered in the chat
 *   - result      → compact facts for the language model
 *   - summary     → plain-language text used by the built-in analyst
 */
import type { AiLang, AiRange } from '@shared/aiTools';
import { AI_RANGES } from '@shared/aiTools';
import { ASSETS, getAsset } from '@/data/assets';
import { portfolioHistory, summarize } from '@/domain/account';
import { uid } from '@/domain/ids';
import type { UserData } from '@/domain/types';
import { money, percent, shares as fmtShares } from '@/lib/format';
import { closeOn, priceAt, pricerFor, timeGrid } from '@/lib/market';
import { DAY, dayEnd, dayNumber } from '@/lib/time';
import { buildForecast, HORIZON_WEIGHTS, indicators, pctStr, scoreUniverse } from './analytics';
import { category, tr } from './i18n';
import { AiError, type ResearchProvider } from './provider';
import type { Block, CompanyReport, Fundamentals, Indicators, Meta, MetricsTable, Pick, PortfolioAnalysis, Pt, Series, Signal, ToolOutput, TradeProposal, WhatIf } from './types';

export interface ToolContext {
  lang: AiLang;
  provider: ResearchProvider;
  data: UserData;
}

type Args = Record<string, unknown>;
const SIM_META = (): Meta => ({ source: 'ELDAR INVEST simulator', real: false, asOf: Date.now() });

/* --------------------------------- Helpers -------------------------------- */

function normSymbol(v: unknown): string {
  return String(v ?? '').trim().toUpperCase().replace(/^\$/, '');
}

function symbolsArg(v: unknown, max: number): string[] {
  const list = (Array.isArray(v) ? v : [v]).map(normSymbol).filter(Boolean);
  return [...new Set(list)].slice(0, max);
}

/** In demo mode only catalogue symbols exist; with real data any valid ticker can be researched. */
function checkSymbol(ctx: ToolContext, symbol: string) {
  if (!/^[A-Z][A-Z0-9.\-]{0,6}$/.test(symbol) || (!ctx.provider.real && !getAsset(symbol))) {
    throw new AiError('unknown_symbol', tr(ctx.lang, 'e.unknownSymbol', { s: symbol || '?', n: ASSETS.length }));
  }
}

function thin(points: Pt[], max = 180): Pt[] {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => points[Math.round(i * step)]);
}

const big = (v: number | null) => {
  if (v === null) return null;
  const a = Math.abs(v);
  const s = a >= 1e12 ? `${(a / 1e12).toFixed(2)}T` : a >= 1e9 ? `${(a / 1e9).toFixed(1)}B` : a >= 1e6 ? `${(a / 1e6).toFixed(0)}M` : a.toFixed(0);
  return `${v < 0 ? '−' : ''}$${s}`;
};
const pc = (v: number | null, digits = 1) => (v === null ? null : pctStr(v, digits));
const plainPct = (v: number | null) => (v === null ? null : `${(v * 100).toFixed(1)}%`);
const n2 = (v: number | null) => (v === null ? null : v.toFixed(2));
const isoTime = (t: number) => new Date(t).toISOString();
const sig = (lang: AiLang, s: Signal) => tr(lang, s.key, s.params);
const demoNote = (ctx: ToolContext, meta: Meta) => (meta.real ? '' : ` ${tr(ctx.lang, 's.demo')}`);

function fail(ctx: ToolContext, e: unknown): ToolOutput {
  const err = e instanceof AiError ? e : new AiError('error', e instanceof Error ? e.message : String(e));
  const rate = err.code === 'provider_rate_limited' || err.code === 'rate_limited';
  const text = rate ? tr(ctx.lang, 'e.rate', { v: err.retryAfter ?? 60 }) : err.code === 'unknown_symbol' || err.code === 'trade' ? err.message : tr(ctx.lang, 'e.generic', { v: err.message });
  return { blocks: [{ type: 'notice', tone: rate ? 'warning' : 'error', text }], result: { error: err.code, message: err.message, retry_after_seconds: err.retryAfter ?? null }, summary: '' };
}

function chartBlock(symbols: string[], range: AiRange, series: Series[], meta: Meta): Extract<Block, { type: 'chart' }> {
  return { type: 'chart', id: uid('ch_'), symbols, range, series: series.map((s) => ({ ...s, points: thin(s.points) })), normalized: series.length > 1, meta };
}

function sliceDaily(daily: Pt[], range: AiRange): Pt[] | null {
  const days = range === '1M' ? 31 : range === '6M' ? 183 : range === '1Y' ? 366 : null;
  if (!days || !daily.length) return null;
  const from = daily[daily.length - 1].t - days * DAY;
  const out = daily.filter((p) => p.t >= from);
  return out.length >= 2 ? out : null;
}

function portfolioSeries(data: UserData, range: AiRange, now: number): Pt[] {
  if (range === '6M') {
    const today = dayNumber(now);
    const grid: number[] = [];
    for (let d = today - 182; d < today; d++) grid.push(dayEnd(d) - 1);
    const g = grid.filter((t) => t >= data.account.startedAt);
    return portfolioHistory(data, [data.account.startedAt > grid[0] ? data.account.startedAt : grid[0], ...g.slice(1), now], (s, t) => (dayNumber(t) < today && t === dayEnd(dayNumber(t)) - 1 ? closeOn(s, dayNumber(t)) : priceAt(s, t)));
  }
  return portfolioHistory(data, timeGrid(range, now, data.account.startedAt), pricerFor(range, now));
}

function seriesFacts(points: Pt[]) {
  const first = points[0].v;
  const last = points[points.length - 1].v;
  return { start: +first.toFixed(2), end: +last.toFixed(2), change_pct: +((last / first - 1) * 100).toFixed(2), high: +Math.max(...points.map((p) => p.v)).toFixed(2), low: +Math.min(...points.map((p) => p.v)).toFixed(2), from: isoTime(points[0].t), to: isoTime(points[points.length - 1].t) };
}

const metaFacts = (m: Meta) => ({ source: m.source, real_market_data: m.real, as_of: isoTime(m.asOf) });

/* ---------------------------------- Tools --------------------------------- */

async function showQuotes(ctx: ToolContext, args: Args): Promise<ToolOutput> {
  const symbols = symbolsArg(args.symbols, 6);
  symbols.forEach((s) => checkSymbol(ctx, s));
  const items = await ctx.provider.quotes(symbols);
  return {
    blocks: [{ type: 'quotes', items }],
    result: { quotes: items.map((q) => ({ symbol: q.symbol, name: q.name, price: +q.price.toFixed(2), day_change_pct: +(q.changePct * 100).toFixed(2), ...metaFacts(q.meta) })) },
    focus: items.map((q) => q.symbol),
    summary: items.map((q) => tr(ctx.lang, 's.quote', { name: q.name, s: q.symbol, p: money(q.price), c: percent(q.changePct) })).join(' ') + demoNote(ctx, items[0].meta),
    suggestions: [tr(ctx.lang, 'sg.analyzeIt', { s: items[0].symbol }), tr(ctx.lang, 'sg.tomorrow'), tr(ctx.lang, 'sg.chart1y')],
  };
}

export async function loadChart(ctx: ToolContext, symbols: string[], range: AiRange): Promise<Extract<Block, { type: 'chart' }>> {
  if (symbols.includes('PORTFOLIO')) {
    const points = portfolioSeries(ctx.data, range, Date.now());
    return chartBlock(['PORTFOLIO'], range, [{ key: 'PORTFOLIO', label: tr(ctx.lang, 'c.portfolioSeries'), points }], SIM_META());
  }
  symbols.forEach((s) => checkSymbol(ctx, s));
  if (!ctx.provider.caps.history) throw new AiError('not_configured', tr(ctx.lang, 'e.noHistory'));
  const loaded = await Promise.all(symbols.map((s) => ctx.provider.history(s, range)));
  return chartBlock(symbols, range, loaded.map((h, i) => ({ key: symbols[i], label: symbols[i], points: h.points })), loaded[0].meta);
}

async function showChart(ctx: ToolContext, args: Args): Promise<ToolOutput> {
  const range = (AI_RANGES as readonly string[]).includes(String(args.range)) ? (args.range as AiRange) : '1M';
  const symbols = symbolsArg(args.symbols, 4);
  const block = await loadChart(ctx, symbols, range);
  const facts = block.series.map((s) => ({ series: s.key, ...seriesFacts(s.points) }));
  const pf = block.symbols[0] === 'PORTFOLIO';
  return {
    blocks: [block],
    result: { range, normalized_percent: block.normalized, series: facts, ...metaFacts(block.meta) },
    focus: pf ? undefined : block.symbols,
    summary:
      (pf
        ? tr(ctx.lang, 's.chartPf', { c: pctStr(facts[0].change_pct / 100, 2), b: money(facts[0].end) })
        : facts.map((f) => tr(ctx.lang, 's.chart', { s: f.series, c: pctStr(f.change_pct / 100, 2), a: money(f.start), b: money(f.end) })).join(' ')) + demoNote(ctx, block.meta),
    suggestions: pf ? [tr(ctx.lang, 'sg.portfolio'), tr(ctx.lang, 'sg.whatif')] : [tr(ctx.lang, 'sg.tomorrow'), tr(ctx.lang, 'sg.analyzeIt', { s: symbols[0] })],
  };
}

async function forecast(ctx: ToolContext, args: Args): Promise<ToolOutput> {
  const symbol = normSymbol(args.symbol);
  checkSymbol(ctx, symbol);
  const horizon = args.horizon === 'day' || args.horizon === 'month' ? args.horizon : 'week';
  if (!ctx.provider.caps.history) throw new AiError('not_configured', tr(ctx.lang, 'e.noHistory'));
  const [[quote], daily, events] = await Promise.all([
    ctx.provider.quotes([symbol]),
    ctx.provider.daily(symbol),
    ctx.provider.real ? ctx.provider.events(horizon === 'month' ? 14 : 7, symbol).catch(() => null) : Promise.resolve(null),
  ]);
  const f = buildForecast({ symbol, name: quote.name, horizon, daily: daily.points, price: quote.price, meta: quote.meta, earningsSoon: events?.items[0]?.date ?? null });
  if (!f) throw new AiError('no_data', tr(ctx.lang, 'e.noHistory'));
  const sc = (k: string) => f.scenarios.find((s) => s.kind === k)!;
  const r2 = (x: number) => +x.toFixed(2);
  return {
    blocks: [{ type: 'forecast', data: f }],
    result: {
      symbol,
      name: quote.name,
      horizon,
      current_price: r2(f.price),
      estimated_range: [r2(f.rangeLow), r2(f.rangeHigh)],
      scenarios: f.scenarios.map((s) => ({ kind: s.kind, price_range: [r2(s.low), r2(s.high)], model_probability_pct: Math.round(s.probability * 100) })),
      technical_signals: f.signals.map((s) => sig('en', s)),
      risks: f.risks.map((s) => sig('en', s)),
      model_confidence: f.confidence,
      data_quality: f.quality,
      method: 'Normal model of historical daily volatility over the horizon; signals tilt odds by at most 6 points. Not a prediction.',
      history_days: daily.points.length,
      ...metaFacts(f.meta),
    },
    focus: [symbol],
    summary: tr(ctx.lang, 's.forecast', { name: quote.name, p: money(f.price), h: tr(ctx.lang, `c.horizon.${horizon}`).toLowerCase(), lo: money(f.rangeLow), hi: money(f.rangeHigh), bl: money(sc('bull').low), bh: money(sc('bull').high), rl: money(sc('bear').low), rh: money(sc('bear').high), conf: tr(ctx.lang, `c.conf.${f.confidence}`).toLowerCase() }) + demoNote(ctx, f.meta),
    suggestions: [horizon === 'month' ? tr(ctx.lang, 'sg.tomorrow') : tr(ctx.lang, 'sg.month'), tr(ctx.lang, 'sg.why'), tr(ctx.lang, 'sg.buy', { s: symbol })],
  };
}

function indicatorRows(lang: AiLang, list: (Indicators | null)[]): MetricsTable['rows'] {
  const row = (key: string, f: (i: Indicators) => string | null) => ({ key: tr(lang, key), values: list.map((i) => (i ? f(i) : null)) });
  return [
    row('m.ret1m', (i) => pc(i.ret1m)),
    row('m.ret3m', (i) => pc(i.ret3m)),
    row('m.ret1y', (i) => pc(i.ret1y)),
    row('m.vol', (i) => `${(i.volAnnual * 100).toFixed(0)}%`),
    row('m.dd', (i) => pc(i.maxDrawdown, 0)),
    row('m.rsi', (i) => (i.rsi14 === null ? null : i.rsi14.toFixed(0))),
    row('m.pos52', (i) => `${(i.pos52 * 100).toFixed(0)}%`),
  ];
}

function fundamentalRows(lang: AiLang, list: (Fundamentals | null)[], caps: (number | null)[]): MetricsTable['rows'] {
  const row = (key: string, f: (m: Fundamentals) => string | null) => ({ key: tr(lang, key), values: list.map((m) => (m ? f(m) : null)) });
  const rows = [
    { key: tr(lang, 'm.cap'), values: caps.map(big) },
    row('m.pe', (m) => n2(m.pe)),
    row('m.revG', (m) => pc(m.revenueGrowth)),
    row('m.margin', (m) => plainPct(m.netMargin)),
    row('m.roe', (m) => plainPct(m.roe)),
    row('m.de', (m) => n2(m.debtToEquity)),
    row('m.div', (m) => plainPct(m.dividendYield)),
  ];
  return rows.filter((r) => r.values.some((v) => v !== null));
}

async function compare(ctx: ToolContext, args: Args): Promise<ToolOutput> {
  const symbols = symbolsArg(args.symbols, 4);
  if (symbols.length < 2) throw new AiError('bad_args', tr(ctx.lang, 'e.needSymbol'));
  symbols.forEach((s) => checkSymbol(ctx, s));
  const range = (AI_RANGES as readonly string[]).includes(String(args.range)) ? (args.range as AiRange) : '6M';
  const p = ctx.provider;
  const [quotes, dailies, funds, profiles] = await Promise.all([
    p.quotes(symbols),
    p.caps.history ? Promise.all(symbols.map((s) => p.daily(s).catch(() => null))) : Promise.resolve(symbols.map(() => null)),
    Promise.all(symbols.map((s) => p.fundamentals(s).catch(() => null))),
    Promise.all(symbols.map((s) => p.profile(s).catch(() => null))),
  ]);
  const bySym = (s: string) => quotes.find((q) => q.symbol === s);
  const inds = symbols.map((s, i) => (dailies[i] && bySym(s) ? indicators(dailies[i]!.points, bySym(s)!.price) : null));
  const blocks: Block[] = [{ type: 'quotes', items: quotes }];
  // Reuse the daily series for the chart when the range allows, to save provider quota.
  const sliced = symbols.map((_, i) => (dailies[i] ? sliceDaily(dailies[i]!.points, range) : null));
  if (sliced.every(Boolean)) blocks.push(chartBlock(symbols, range, symbols.map((s, i) => ({ key: s, label: s, points: sliced[i]! })), dailies[0]!.meta));
  else if (p.caps.history) blocks.push(await loadChart(ctx, symbols, range));
  const table: MetricsTable = {
    columns: symbols.map((s) => ({ symbol: s, name: bySym(s)?.name ?? s })),
    rows: [
      { key: tr(ctx.lang, 'm.price'), values: symbols.map((s) => (bySym(s) ? money(bySym(s)!.price) : null)) },
      { key: tr(ctx.lang, 'm.day'), values: symbols.map((s) => (bySym(s) ? percent(bySym(s)!.changePct) : null)) },
      ...indicatorRows(ctx.lang, inds),
      ...fundamentalRows(ctx.lang, funds, profiles.map((x) => x?.marketCap ?? null)),
    ],
    meta: quotes[0].meta,
    note: funds.every((f) => !f) ? tr(ctx.lang, p.real ? 'c.missing' : 'e.fundDemo') : undefined,
  };
  blocks.push({ type: 'metrics', table });
  const facts = symbols.map((s, i) => ({ symbol: s, name: bySym(s)?.name, price: bySym(s)?.price, day_change_pct: bySym(s) ? +(bySym(s)!.changePct * 100).toFixed(2) : null, return_1m: pc(inds[i]?.ret1m ?? null), return_3m: pc(inds[i]?.ret3m ?? null), return_1y: pc(inds[i]?.ret1y ?? null), volatility_annual_pct: inds[i] ? +(inds[i]!.volAnnual * 100).toFixed(0) : null, max_drawdown_1y: pc(inds[i]?.maxDrawdown ?? null, 0), rsi14: inds[i]?.rsi14 ? +inds[i]!.rsi14!.toFixed(0) : null, fundamentals: funds[i] ? { pe: funds[i]!.pe, revenue_growth: pc(funds[i]!.revenueGrowth), net_margin: plainPct(funds[i]!.netMargin), roe: plainPct(funds[i]!.roe), debt_to_equity: funds[i]!.debtToEquity } : 'unavailable', market_cap: big(profiles[i]?.marketCap ?? null) }));
  return {
    blocks,
    result: { compared: facts, chart_range: range, ...metaFacts(quotes[0].meta) },
    focus: symbols,
    summary: tr(ctx.lang, 's.compare', { list: symbols.join(' / '), perf: symbols.map((s, i) => `${s} ${pc(inds[i]?.ret1y ?? null) ?? '—'}`).join(', '), vol: symbols.map((s, i) => `${s} ${inds[i] ? (inds[i]!.volAnnual * 100).toFixed(0) + '%' : '—'}`).join(', ') }) + demoNote(ctx, quotes[0].meta),
    suggestions: [tr(ctx.lang, 'sg.analyzeIt', { s: symbols[0] }), tr(ctx.lang, 'sg.analyzeIt', { s: symbols[1] }), tr(ctx.lang, 'sg.tomorrow')],
  };
}

async function analyzeCompany(ctx: ToolContext, args: Args): Promise<ToolOutput> {
  const symbol = normSymbol(args.symbol);
  checkSymbol(ctx, symbol);
  const p = ctx.provider;
  const L = (k: string) => tr(ctx.lang, k);
  const [quotes, profile, daily, fundamentals, filings, news] = await Promise.all([
    p.quotes([symbol]),
    p.profile(symbol),
    p.caps.history ? p.daily(symbol).catch(() => null) : Promise.resolve(null),
    p.fundamentals(symbol).catch(() => null),
    p.filings(symbol).catch(() => null),
    p.caps.news ? p.news(symbol).catch(() => null) : Promise.resolve(null),
  ]);
  const quote = quotes[0];
  const ind = daily ? indicators(daily.points, quote.price) : null;
  const missing: string[] = [];
  if (!ind) missing.push(L('c.technical'));
  if (!fundamentals) missing.push(L('c.keyMetrics'));
  if (!filings) missing.push(L('c.financials'));
  if (!news) missing.push(L('c.news'));
  const held = ctx.data.holdings[symbol];
  const sim = getAsset(symbol) ? priceAt(symbol, Date.now()) : 0;
  const report: CompanyReport = {
    symbol,
    quote,
    profile,
    indicators: ind,
    fundamentals,
    filings,
    news: news?.items.slice(0, 5) ?? null,
    missing,
    owned: held ? { shares: held.shares, value: held.shares * sim, pnlPct: (held.shares * sim - held.costBasis) / held.costBasis } : null,
  };
  const blocks: Block[] = [{ type: 'company', data: report }];
  const six = daily ? sliceDaily(daily.points, '6M') : null;
  if (six) blocks.push(chartBlock([symbol], '6M', [{ key: symbol, label: symbol, points: [...six, { t: quote.meta.asOf, v: quote.price }].sort((a, b) => a.t - b.t) }], daily!.meta));
  if (news?.items.length) blocks.push({ type: 'news', title: tr(ctx.lang, 'c.newsFor', { s: symbol }), items: news.items.slice(0, 5), meta: news.meta });
  const fundText = fundamentals ? [fundamentals.pe !== null && `P/E ${n2(fundamentals.pe)}`, fundamentals.revenueGrowth !== null && `${L('m.revG').toLowerCase()} ${pc(fundamentals.revenueGrowth)}`, fundamentals.netMargin !== null && `${L('m.margin').toLowerCase()} ${plainPct(fundamentals.netMargin)}`].filter(Boolean).join(', ') : '';
  const parts = [
    tr(ctx.lang, 's.company', { name: quote.name, s: symbol, p: money(quote.price), c: percent(quote.changePct), desc: ctx.lang === 'en' ? profile.description ?? '' : '' }).trim(),
    ind && tr(ctx.lang, 's.companyTech', { trend: ind.sma200 !== null && ind.price < ind.sma200 ? L('s.trendDown') : L('s.trendUp'), y: pc(ind.ret1y) ?? '—', v: (ind.volAnnual * 100).toFixed(0) }),
    fundText && tr(ctx.lang, 's.companyFund', { f: fundText }),
    missing.length && tr(ctx.lang, 's.companyMissing', { m: missing.join(', ').toLowerCase() }),
  ].filter(Boolean);
  return {
    blocks,
    result: {
      symbol,
      name: quote.name,
      price: +quote.price.toFixed(2),
      day_change_pct: +(quote.changePct * 100).toFixed(2),
      ...metaFacts(quote.meta),
      profile: { industry: profile.industry, exchange: profile.exchange, country: profile.country, market_cap: big(profile.marketCap), ipo: profile.ipo, catalogue_description: profile.description },
      technical: ind ? { return_1m: pc(ind.ret1m), return_3m: pc(ind.ret3m), return_1y: pc(ind.ret1y), sma50: n2(ind.sma50), sma200: n2(ind.sma200), rsi14: ind.rsi14?.toFixed(0) ?? null, volatility_annual_pct: +(ind.volAnnual * 100).toFixed(0), week52_high: n2(ind.high52), week52_low: n2(ind.low52), max_drawdown_1y: pc(ind.maxDrawdown, 0) } : 'unavailable',
      fundamentals: fundamentals ? { pe: fundamentals.pe, eps_ttm: fundamentals.eps, beta: fundamentals.beta, revenue_growth_yoy: pc(fundamentals.revenueGrowth), eps_growth_yoy: pc(fundamentals.epsGrowth), net_margin: plainPct(fundamentals.netMargin), gross_margin: plainPct(fundamentals.grossMargin), roe: plainPct(fundamentals.roe), debt_to_equity: fundamentals.debtToEquity, current_ratio: fundamentals.currentRatio, dividend_yield: plainPct(fundamentals.dividendYield), recent_quarterly_eps: fundamentals.earnings, source: fundamentals.meta.source } : 'unavailable (do not invent figures)',
      latest_annual_report: filings ? { fiscal_year: filings.fiscalYear, period_end: filings.periodEnd, revenue: big(filings.revenue), revenue_prev_year: big(filings.revenuePrev), net_income: big(filings.netIncome), net_income_prev_year: big(filings.netIncomePrev), total_assets: big(filings.assets), total_liabilities: big(filings.liabilities), equity: big(filings.equity), cash: big(filings.cash), long_term_debt: big(filings.longTermDebt), source: filings.meta.source, filed: isoTime(filings.meta.asOf).slice(0, 10) } : 'unavailable (do not invent figures)',
      recent_news: news ? news.items.slice(0, 5).map((n) => ({ headline: n.headline, source: n.source, published: isoTime(n.publishedAt).slice(0, 16), summary: n.summary.slice(0, 220) })) : 'unavailable (do not invent news)',
      user_position: report.owned ? { shares: report.owned.shares, value_simulated: +report.owned.value.toFixed(2), pnl_pct: pc(report.owned.pnlPct) } : 'none',
    },
    focus: [symbol],
    summary: parts.join('\n\n') + demoNote(ctx, quote.meta),
    suggestions: [tr(ctx.lang, 'sg.tomorrow'), tr(ctx.lang, 'sg.compareWith', { s: peerOf(symbol) }), tr(ctx.lang, 'sg.buy', { s: symbol })],
  };
}

function peerOf(symbol: string): string {
  const a = getAsset(symbol);
  const peer = ASSETS.find((x) => x.symbol !== symbol && x.category === (a?.category ?? 'Technology'));
  return peer?.name ?? 'Microsoft';
}

async function getNews(ctx: ToolContext, args: Args): Promise<ToolOutput> {
  const symbol = args.symbol ? normSymbol(args.symbol) : undefined;
  if (symbol) checkSymbol(ctx, symbol);
  if (!ctx.provider.caps.news) {
    const blocks: Block[] = [{ type: 'notice', tone: 'info', text: tr(ctx.lang, 'e.newsDemo') }];
    let extra = '';
    if (symbol) {
      const q = await showQuotes(ctx, { symbols: [symbol] });
      blocks.unshift(...q.blocks);
      extra = q.summary;
    }
    return { blocks, result: { news: 'unavailable: no news provider is connected. Do not invent headlines or causes.' }, focus: symbol ? [symbol] : undefined, summary: extra, suggestions: symbol ? [tr(ctx.lang, 'sg.tomorrow'), tr(ctx.lang, 'sg.chart1y')] : [tr(ctx.lang, 'sg.picks')] };
  }
  const [news, quotes] = await Promise.all([ctx.provider.news(symbol), symbol ? ctx.provider.quotes([symbol]).catch(() => []) : Promise.resolve([])]);
  const blocks: Block[] = [];
  if (quotes.length) blocks.push({ type: 'quotes', items: quotes });
  blocks.push({ type: 'news', title: symbol ? tr(ctx.lang, 'c.newsFor', { s: symbol }) : tr(ctx.lang, 'c.marketNews'), items: news.items.slice(0, 8), meta: news.meta });
  return {
    blocks,
    result: {
      symbol: symbol ?? 'market',
      quote: quotes[0] ? { price: quotes[0].price, day_change_pct: +(quotes[0].changePct * 100).toFixed(2) } : undefined,
      headlines: news.items.slice(0, 8).map((n) => ({ headline: n.headline, source: n.source, published: isoTime(n.publishedAt).slice(0, 16), summary: n.summary.slice(0, 260) })),
      note: 'Headlines are facts as reported by publishers. Any link between a headline and a price move is your interpretation and must be labelled as such.',
      ...metaFacts(news.meta),
    },
    focus: symbol ? [symbol] : undefined,
    summary: news.items.length ? tr(ctx.lang, 's.news') : tr(ctx.lang, 'c.noNews'),
    suggestions: symbol ? [tr(ctx.lang, 'sg.tomorrow'), tr(ctx.lang, 'sg.analyzeIt', { s: symbol })] : [tr(ctx.lang, 'sg.picks'), tr(ctx.lang, 'sg.portfolio')],
  };
}

async function getEvents(ctx: ToolContext, args: Args): Promise<ToolOutput> {
  const symbol = args.symbol ? normSymbol(args.symbol) : undefined;
  if (!ctx.provider.caps.news) return { blocks: [{ type: 'notice', tone: 'info', text: tr(ctx.lang, 'e.eventsDemo') }], result: { events: 'unavailable: no provider connected. Do not invent dates.' }, summary: '' };
  const days = Math.min(14, Math.max(1, Number(args.days) || 7));
  const ev = await ctx.provider.events(days, symbol);
  return {
    blocks: [{ type: 'events', items: ev.items.slice(0, 20), meta: ev.meta }],
    result: { days_ahead: days, earnings_reports: ev.items.slice(0, 20), ...metaFacts(ev.meta) },
    summary: ev.items.length ? tr(ctx.lang, 's.events') : tr(ctx.lang, 'c.noEvents'),
  };
}

const FACTOR_FMT: Record<string, (v: number) => string> = {
  ret5d: (v) => pctStr(v),
  ret13w: (v) => pctStr(v),
  ret26w: (v) => pctStr(v),
  ret52w: (v) => pctStr(v),
  pos52: (v) => `${(v * 100).toFixed(0)}%`,
  risk: (v) => v.toFixed(2),
  pe: (v) => v.toFixed(1),
  revenueGrowth: (v) => pctStr(v),
  epsGrowth: (v) => pctStr(v),
  netMargin: (v) => `${(v * 100).toFixed(1)}%`,
  roe: (v) => `${(v * 100).toFixed(1)}%`,
  debtToEquity: (v) => v.toFixed(2),
};
const FACTOR_LABEL: Record<string, string> = { ret5d: 'm.ret1w', ret13w: 'm.ret3m', ret26w: 'm.ret6m', ret52w: 'm.ret1y', risk: 'm.risk', pe: 'm.pe', revenueGrowth: 'm.revG', epsGrowth: 'm.eps', netMargin: 'm.margin', roe: 'm.roe', debtToEquity: 'm.de', pos52: 'm.pos52' };

export async function buildPicks(ctx: ToolContext, horizon: 'short' | 'medium' | 'long', count: number, kind: 'any' | 'stock' | 'etf'): Promise<Pick[]> {
  const screen = await ctx.provider.screen();
  const scored = scoreUniverse(screen.rows.filter((r) => getAsset(r.symbol) && (kind === 'any' || getAsset(r.symbol)!.type === kind)), horizon).filter((s) => s.score > 0);
  // Keep the list varied: at most two candidates per sector.
  const perCat = new Map<string, number>();
  const chosen = scored.filter((s) => {
    const c = getAsset(s.row.symbol)!.category;
    const n = perCat.get(c) ?? 0;
    if (n >= 2 && kind !== 'etf') return false;
    perCat.set(c, n + 1);
    return true;
  }).slice(0, count);
  if (!chosen.length) return [];
  const quotes = await ctx.provider.quotes(chosen.map((c) => c.row.symbol));
  const total = summarize(ctx.data, Date.now());
  return chosen.flatMap((c) => {
    const a = getAsset(c.row.symbol)!;
    const q = quotes.find((x) => x.symbol === a.symbol);
    if (!q) return [];
    const val = (f: string) => FACTOR_FMT[f](c.row[f as keyof typeof c.row] as number);
    const reasons: Signal[] = c.factors.filter((f) => f.contribution > 0.05).slice(0, 3).map((f) => ({ key: `pick.good.${f.factor}`, tone: 'up', params: { v: val(f.factor) } }));
    const risks: Signal[] = c.factors.filter((f) => f.contribution < -0.05).slice(-2).map((f) => ({ key: `pick.bad.${f.factor}`, tone: 'down', params: { v: val(f.factor) } }));
    risks.push({ key: horizon === 'short' ? 'pick.risk.reversal' : 'pick.risk.market', tone: 'flat', params: {} });
    if (!ctx.provider.real) risks.push({ key: 'pick.risk.noFundamentals', tone: 'flat', params: {} });
    const opps: Signal[] = [];
    if (a.type === 'etf') opps.push({ key: 'pick.opp.etf', tone: 'up', params: {} });
    if ((c.row.revenueGrowth ?? 0) > 0.05) opps.push({ key: 'pick.opp.growth', tone: 'up', params: {} });
    if ((c.row.roe ?? 0) > 0.15 || (c.row.netMargin ?? 0) > 0.15) opps.push({ key: 'pick.opp.quality', tone: 'up', params: {} });
    if ((c.row.ret13w ?? 0) > 0) opps.push({ key: 'pick.opp.momentum', tone: 'up', params: {} });
    else if ((c.row.pos52 ?? 1) < 0.5) opps.push({ key: 'pick.opp.rebound', tone: 'up', params: {} });
    const pos = total.positions.find((x) => x.symbol === a.symbol);
    return [{
      symbol: a.symbol,
      name: q.name,
      logo: q.logo,
      kind: a.type,
      category: a.category,
      overview: a.description,
      price: q.price,
      changePct: q.changePct,
      score: Math.round(c.score * 100),
      reasons,
      opportunities: opps.slice(0, 2),
      risks,
      metrics: c.factors.map((f) => ({ key: FACTOR_LABEL[f.factor], value: val(f.factor) })),
      ownedWeight: pos ? pos.weight : null,
      meta: q.meta,
      sources: [...new Set([q.meta.source, screen.meta.source])],
    }];
  });
}

async function stockPicks(ctx: ToolContext, args: Args): Promise<ToolOutput> {
  const horizon = args.horizon === 'short' || args.horizon === 'long' ? args.horizon : 'medium';
  const count = Math.min(8, Math.max(1, Number(args.count) || 5));
  const kind = args.kind === 'stock' || args.kind === 'etf' ? args.kind : 'any';
  const items = await buildPicks(ctx, horizon, count, kind);
  if (!items.length) throw new AiError('no_data', tr(ctx.lang, 'e.noHistory'));
  return {
    blocks: [{ type: 'picks', horizon, items }],
    result: {
      horizon,
      disclaimer: 'Research candidates ranked by a transparent factor score. Not buy recommendations.',
      scoring_factors: Object.keys(HORIZON_WEIGHTS[horizon]),
      candidates: items.map((p) => ({ symbol: p.symbol, name: p.name, type: p.kind, sector: p.category, price: +p.price.toFixed(2), day_change_pct: +(p.changePct * 100).toFixed(2), score_0_100: p.score, why_selected: p.reasons.map((s) => sig('en', s)), risks: p.risks.map((s) => sig('en', s)), already_owned_weight_pct: p.ownedWeight === null ? null : +(p.ownedWeight * 100).toFixed(1) })),
      ...metaFacts(items[0].meta),
    },
    summary: tr(ctx.lang, 's.picks', { n: items.length, h: tr(ctx.lang, `c.h.${horizon}`).toLowerCase(), list: items.map((p) => `${p.name} (${p.symbol})`).join(', '), f: tr(ctx.lang, `c.hd.${horizon}`) }) + demoNote(ctx, items[0].meta),
    suggestions: [tr(ctx.lang, 'sg.analyzeIt', { s: items[0].symbol }), items[1] ? tr(ctx.lang, 'sg.compare2', { a: items[0].symbol, b: items[1].symbol }) : tr(ctx.lang, 'sg.portfolio')],
  };
}

export function analyzePortfolioData(ctx: ToolContext): PortfolioAnalysis {
  const now = Date.now();
  const s = summarize(ctx.data, now);
  const today = dayNumber(now);
  const volOf = (symbol: string) => {
    const pts: Pt[] = [];
    for (let d = today - 252; d < today; d++) pts.push({ t: d, v: closeOn(symbol, d) });
    return indicators(pts, priceAt(symbol, now)).volAnnual;
  };
  const raw = s.positions.map((p) => ({ ...p, vol: volOf(p.symbol) }));
  const riskSum = raw.reduce((a, p) => a + p.value * p.vol, 0) || 1;
  const positions = raw.map((p) => ({ symbol: p.symbol, name: getAsset(p.symbol)?.name ?? p.symbol, value: p.value, weight: p.weight, pnl: p.pnl, pnlPct: p.pnlPct, shares: p.shares, avgCost: p.avgCost, vol: p.vol, riskShare: (p.value * p.vol) / riskSum }));
  const sectorMap = new Map<string, number>();
  for (const p of positions) sectorMap.set(getAsset(p.symbol)?.category ?? 'Other', (sectorMap.get(getAsset(p.symbol)?.category ?? 'Other') ?? 0) + p.value);
  const invested = s.invested || 1;
  const sectors = [...sectorMap].map(([name, v]) => ({ name, weight: v / invested })).sort((a, b) => b.weight - a.weight);
  const hhi = positions.reduce((a, p) => a + (p.value / invested) ** 2, 0);
  const concentration: PortfolioAnalysis['concentration'] = !positions.length ? 'low' : hhi > 0.3 ? 'high' : hhi > 0.16 ? 'moderate' : 'low';
  const portfolioVol = positions.reduce((a, p) => a + (p.value / invested) * p.vol, 0);
  const cashW = s.total > 0 ? s.cash / s.total : 1;
  const P = (v: number) => (v * 100).toFixed(0);
  const strengths: Signal[] = [];
  const weaknesses: Signal[] = [];
  const ideas: Signal[] = [];
  const etfW = positions.filter((p) => getAsset(p.symbol)?.type === 'etf' && !['BND', 'GLD'].includes(p.symbol)).reduce((a, p) => a + p.weight, 0);
  const safeW = positions.filter((p) => ['BND', 'GLD'].includes(p.symbol)).reduce((a, p) => a + p.weight, 0);
  const top = positions[0];
  if (!positions.length) {
    weaknesses.push({ key: 'pf.empty', tone: 'flat', params: {} });
    ideas.push({ key: 'pf.idea.start', tone: 'up', params: {} });
  } else {
    if (positions.length >= 5 && sectors.length >= 3) strengths.push({ key: 'pf.diversified', tone: 'up', params: { n: String(positions.length), k: String(sectors.length) } });
    if (etfW >= 0.1) strengths.push({ key: 'pf.hasEtf', tone: 'up', params: { v: P(etfW) } });
    if (safeW >= 0.04) strengths.push({ key: 'pf.hasBonds', tone: 'up', params: { v: P(safeW) } });
    if (cashW >= 0.05 && cashW <= 0.4) strengths.push({ key: 'pf.cashBuffer', tone: 'up', params: { v: P(cashW) } });
    if (s.totalReturn > 0) strengths.push({ key: 'pf.profit', tone: 'up', params: { v: pctStr(s.totalReturnPct, 2) } });
    if (concentration === 'low' && positions.length >= 4) strengths.push({ key: 'pf.lowConc', tone: 'up', params: {} });
    if (top.value / invested > 0.3) weaknesses.push({ key: 'pf.topHeavy', tone: 'down', params: { s: top.symbol, v: P(top.weight) } });
    if (sectors[0].weight > 0.45 && sectors[0].name !== 'ETFs') weaknesses.push({ key: 'pf.sectorHeavy', tone: 'down', params: { s: category(ctx.lang, sectors[0].name), v: P(sectors[0].weight) } });
    if (positions.length < 4) weaknesses.push({ key: 'pf.fewPositions', tone: 'down', params: { n: String(positions.length) } });
    if (cashW > 0.4) weaknesses.push({ key: 'pf.cashDrag', tone: 'flat', params: { v: P(cashW) } });
    if (cashW < 0.02) weaknesses.push({ key: 'pf.noCash', tone: 'flat', params: { v: (cashW * 100).toFixed(1) } });
    if (portfolioVol > 0.35) weaknesses.push({ key: 'pf.highVol', tone: 'down', params: { v: P(portfolioVol) } });
    const loser = [...positions].sort((a, b) => a.pnlPct - b.pnlPct)[0];
    if (loser.pnlPct < -0.1) weaknesses.push({ key: 'pf.loser', tone: 'down', params: { s: loser.symbol, v: pctStr(Math.abs(loser.pnlPct)).slice(1) } });
    if (s.totalReturn < 0) weaknesses.push({ key: 'pf.loss', tone: 'down', params: { v: pctStr(Math.abs(s.totalReturnPct), 2).slice(1) } });
    const held = new Set(sectors.map((x) => x.name));
    for (const cat of ['Healthcare', 'Financials', 'Technology', 'Consumer', 'Energy', 'Industrials', 'Communication']) {
      if (ideas.length >= 2) break;
      if (!held.has(cat)) ideas.push({ key: 'pf.idea.sector', tone: 'up', params: { s: category(ctx.lang, cat), list: ASSETS.filter((a) => a.category === cat).slice(0, 2).map((a) => a.symbol).join(', ') } });
    }
    if (etfW < 0.1) ideas.push({ key: 'pf.idea.etf', tone: 'up', params: {} });
    if (safeW < 0.04 && portfolioVol > 0.25) ideas.push({ key: 'pf.idea.bonds', tone: 'up', params: {} });
    if (top.value / invested > 0.3) ideas.push({ key: 'pf.idea.trim', tone: 'flat', params: { s: top.symbol } });
  }
  return { total: s.total, cash: s.cash, invested: s.invested, cashWeight: cashW, totalReturn: s.totalReturn, totalReturnPct: s.totalReturnPct, dayChange: s.dayChange, unrealizedPnl: s.unrealizedPnl, realizedPnl: s.realizedPnl, positions, sectors, hhi, concentration, portfolioVol, strengths, weaknesses, ideas, trades: ctx.data.transactions.filter((t) => t.type !== 'deposit').length, meta: SIM_META() };
}

async function analyzePortfolio(ctx: ToolContext): Promise<ToolOutput> {
  const a = analyzePortfolioData(ctx);
  const recent = ctx.data.transactions.filter((t) => t.type !== 'deposit').slice(-5).reverse();
  return {
    blocks: [{ type: 'portfolio', data: a }],
    result: {
      valued_at: 'ELDAR INVEST simulated prices (virtual account)',
      total_value: +a.total.toFixed(2),
      cash: +a.cash.toFixed(2),
      cash_weight_pct: +(a.cashWeight * 100).toFixed(1),
      invested: +a.invested.toFixed(2),
      total_return_pct: +(a.totalReturnPct * 100).toFixed(2),
      unrealized_pnl: +a.unrealizedPnl.toFixed(2),
      realized_pnl: +a.realizedPnl.toFixed(2),
      positions: a.positions.map((p) => ({ symbol: p.symbol, name: p.name, sector: getAsset(p.symbol)?.category, shares: p.shares, avg_cost: +p.avgCost.toFixed(2), value: +p.value.toFixed(2), weight_pct: +(p.weight * 100).toFixed(1), pnl_pct: +(p.pnlPct * 100).toFixed(1), volatility_pct: +(p.vol * 100).toFixed(0), share_of_risk_pct: +(p.riskShare * 100).toFixed(0) })),
      sector_weights_of_invested_pct: a.sectors.map((s) => ({ sector: s.name, pct: +(s.weight * 100).toFixed(0) })),
      concentration: a.concentration,
      herfindahl_index: +a.hhi.toFixed(2),
      strengths: a.strengths.map((s) => sig('en', s)),
      weaknesses: a.weaknesses.map((s) => sig('en', s)),
      diversification_ideas: a.ideas.map((s) => sig('en', s)),
      recent_trades: recent.map((t) => ({ type: t.type, symbol: t.symbol, shares: t.shares, price: t.price, date: isoTime(t.at).slice(0, 10) })),
      trade_count: a.trades,
    },
    summary: [tr(ctx.lang, 's.portfolio', { t: money(a.total), i: money(a.invested), n: a.positions.length, c: money(a.cash), r: pctStr(a.totalReturnPct, 2), conc: tr(ctx.lang, `c.conc.${a.concentration}`) }), a.weaknesses[0] && tr(ctx.lang, 's.portfolioTop', { w: sig(ctx.lang, a.weaknesses[0]) })].filter(Boolean).join(' '),
    suggestions: [tr(ctx.lang, 'sg.pfChart'), tr(ctx.lang, 'sg.whatif'), tr(ctx.lang, 'sg.picks')],
  };
}

async function getAccount(ctx: ToolContext): Promise<ToolOutput> {
  const s = summarize(ctx.data, Date.now());
  return {
    blocks: [{ type: 'account', total: s.total, cash: s.cash, invested: s.invested, positions: s.positions.map((p) => ({ symbol: p.symbol, value: p.value, shares: p.shares })), meta: SIM_META() }],
    result: { cash: +s.cash.toFixed(2), invested: +s.invested.toFixed(2), total: +s.total.toFixed(2), holdings: s.positions.map((p) => ({ symbol: p.symbol, shares: p.shares, value: +p.value.toFixed(2) })) },
    summary: tr(ctx.lang, 's.account', { c: money(s.cash), i: money(s.invested), t: money(s.total) }),
    suggestions: [tr(ctx.lang, 'sg.portfolio'), tr(ctx.lang, 'sg.picks')],
  };
}

async function whatIf(ctx: ToolContext, args: Args): Promise<ToolOutput> {
  const list = (Array.isArray(args.changes) ? args.changes : []) as { symbol?: unknown; pct?: unknown }[];
  const s = summarize(ctx.data, Date.now());
  const changes = list.slice(0, 5).map((c) => {
    const symbol = normSymbol(c.symbol);
    const pct = Math.max(-100, Math.min(1000, Number(c.pct) || 0));
    const pos = s.positions.find((p) => p.symbol === symbol);
    return { symbol, pct, held: !!pos, value: pos?.value ?? 0, impact: (pos?.value ?? 0) * (pct / 100) };
  }).filter((c) => c.symbol);
  if (!changes.length) throw new AiError('bad_args', tr(ctx.lang, 'e.needSymbol'));
  const delta = changes.reduce((a, c) => a + c.impact, 0);
  const data: WhatIf = { changes, before: s.total, after: s.total + delta, delta, deltaPct: s.total ? delta / s.total : 0, meta: SIM_META() };
  const noneHeld = changes.every((c) => !c.held);
  return {
    blocks: [{ type: 'whatif', data }],
    result: { portfolio_before: +data.before.toFixed(2), portfolio_after: +data.after.toFixed(2), change: +delta.toFixed(2), change_pct: +(data.deltaPct * 100).toFixed(2), per_symbol: changes.map((c) => ({ symbol: c.symbol, assumed_move_pct: c.pct, held: c.held, position_value: +c.value.toFixed(2), impact: +c.impact.toFixed(2) })), note: 'Hypothetical arithmetic on current simulated values; other holdings assumed unchanged.' },
    focus: [changes[0].symbol],
    summary: noneHeld ? tr(ctx.lang, 's.whatifNone', { s: changes.map((c) => c.symbol).join(', ') }) : tr(ctx.lang, 's.whatif', { moves: changes.map((c) => `${c.symbol} ${c.pct >= 0 ? '+' : '−'}${Math.abs(c.pct)}%`).join(', '), d: money(delta, { sign: true }), dp: pctStr(data.deltaPct, 2), a: money(data.before), b: money(data.after) }),
    suggestions: [tr(ctx.lang, 'sg.portfolio'), tr(ctx.lang, 'sg.analyzeIt', { s: changes[0].symbol })],
  };
}

async function proposeTrade(ctx: ToolContext, args: Args): Promise<ToolOutput> {
  const symbol = normSymbol(args.symbol);
  const asset = getAsset(symbol);
  const L = ctx.lang;
  if (!asset) throw new AiError('trade', tr(L, 'e.notTradable', { s: symbol || '?' }));
  const side = args.side === 'sell' ? 'sell' : 'buy';
  const price = priceAt(symbol, Date.now());
  const cash = ctx.data.account.cash;
  const held = ctx.data.holdings[symbol]?.shares ?? 0;
  const amount = Number(args.amount_usd);
  const qty = Number(args.shares);
  const fraction = Number(args.fraction);
  const proposal: Partial<TradeProposal> = {};
  if (side === 'sell') {
    if (held <= 0) throw new AiError('trade', tr(L, 'e.noPosition', { s: symbol }));
    if (fraction > 0) proposal.shares = Math.round(held * Math.min(1, fraction) * 1e6) / 1e6;
    else if (qty > 0) proposal.shares = qty;
    else if (amount > 0) {
      if (amount >= held * price * 0.999) proposal.shares = held;
      else proposal.amount = Math.round(amount * 100) / 100;
    } else throw new AiError('trade', tr(L, 'e.needAmount'));
    const sh = proposal.shares ?? proposal.amount! / price;
    if (sh > held + 1e-6) throw new AiError('trade', tr(L, 'e.tooMany', { have: fmtShares(held), s: symbol, need: fmtShares(sh) }));
  } else {
    if (qty > 0) proposal.shares = Math.round(qty * 1e6) / 1e6;
    else if (amount > 0) proposal.amount = Math.round(amount * 100) / 100;
    else throw new AiError('trade', tr(L, 'e.needAmount'));
    const need = proposal.amount ?? proposal.shares! * price;
    if (need < 1) throw new AiError('trade', tr(L, 'e.minOrder'));
    if (need > cash + 0.001) throw new AiError('trade', tr(L, 'e.insufficient', { need: money(need), have: money(cash) }));
  }
  const estShares = proposal.shares ?? proposal.amount! / price;
  const estTotal = proposal.amount ?? proposal.shares! * price;
  const full: TradeProposal = { id: uid('tp_'), side, symbol, name: asset.name, amount: proposal.amount, shares: proposal.shares, estPrice: price, estShares, estTotal, cashAfter: side === 'buy' ? cash - estTotal : cash + estTotal, status: 'pending', createdAt: Date.now() };
  return {
    blocks: [{ type: 'trade', proposal: full }],
    result: { status: 'AWAITING_USER_CONFIRMATION', executed: false, side, symbol, estimated_shares: +estShares.toFixed(4), estimated_price_simulated: +price.toFixed(2), estimated_total: +estTotal.toFixed(2), cash_after: +full.cashAfter.toFixed(2), instruction: 'A confirmation card is shown. Tell the user to press Confirm on the card. Do not claim the trade is done.' },
    focus: [symbol],
    summary: tr(L, 's.trade'),
  };
}

const TOOLS: Record<string, (ctx: ToolContext, args: Args) => Promise<ToolOutput>> = {
  show_quotes: showQuotes,
  show_chart: showChart,
  forecast,
  compare,
  analyze_company: analyzeCompany,
  get_news: getNews,
  get_events: getEvents,
  stock_picks: stockPicks,
  analyze_portfolio: analyzePortfolio,
  get_account: getAccount,
  what_if: whatIf,
  propose_trade: proposeTrade,
};

/** Runs a tool by name. Never throws: failures become a notice block plus an error result for the model. */
export async function runTool(ctx: ToolContext, name: string, args: Args): Promise<ToolOutput> {
  const tool = TOOLS[name];
  if (!tool) return fail(ctx, new AiError('unknown_tool', `Unknown tool: ${name}`));
  try {
    return await tool(ctx, args ?? {});
  } catch (e) {
    return fail(ctx, e);
  }
}
