/**
 * Built-in language understanding for ELDAR AI (English + Russian).
 * Used when no Gemini backend is connected, and as the fallback when the AI
 * service is rate-limited — so the analyst keeps working either way.
 */
import type { AiRange } from '@shared/aiTools';
import { findSymbols } from './symbols';

export type Intent =
  | { tool: 'propose_trade'; args: { side: 'buy' | 'sell'; symbol: string; amount_usd?: number; shares?: number; fraction?: number } }
  | { tool: 'what_if'; args: { changes: { symbol: string; pct: number }[] } }
  | { tool: 'get_account'; args: Record<string, never> }
  | { tool: 'compare'; args: { symbols: string[]; range?: AiRange } }
  | { tool: 'forecast'; args: { symbol: string; horizon: 'day' | 'week' | 'month' } }
  | { tool: 'stock_picks'; args: { horizon: 'short' | 'medium' | 'long'; count?: number; kind?: 'any' | 'stock' | 'etf' } }
  | { tool: 'analyze_portfolio'; args: Record<string, never> }
  | { tool: 'get_news'; args: { symbol?: string } }
  | { tool: 'get_events'; args: { symbol?: string; days?: number } }
  | { tool: 'show_chart'; args: { symbols: string[]; range: AiRange } }
  | { tool: 'analyze_company'; args: { symbol: string } }
  | { tool: 'show_quotes'; args: { symbols: string[] } }
  | { tool: 'help'; args: { reason: 'greeting' | 'unknown' | 'need_symbol' | 'need_amount' } };

const has = (t: string, re: RegExp) => re.test(t);
const num = (s: string) => parseFloat(s.replace(/[\s,](?=\d{3}\b)/g, '').replace(',', '.'));

function parseRange(t: string): AiRange | null {
  const m = /\b(1d|1w|1m|6m|1y|5y)\b/i.exec(t);
  if (m) return m[1].toUpperCase() as AiRange;
  if (has(t, /5\s*(years|year|yr|лет|года)|пять лет/)) return '5Y';
  if (has(t, /6\s*(months|month|мес)|half a year|полгода|пол года/)) return '6M';
  if (has(t, /\b(year|1\s*yr)\b|за год|годовой|год\b/)) return '1Y';
  if (has(t, /\bmonth\b|месяц/)) return '1M';
  if (has(t, /\bweek\b|недел/)) return '1W';
  if (has(t, /\b(today|day|intraday)\b|сегодня|день|дня/)) return '1D';
  return null;
}

function parseHorizon(t: string): 'day' | 'week' | 'month' | null {
  if (has(t, /tomorrow|next day|завтра|на день|ближайший день/)) return 'day';
  if (has(t, /week|недел/)) return 'week';
  if (has(t, /month|месяц/)) return 'month';
  return null;
}

function parseTrade(t: string, side: 'buy' | 'sell') {
  const out: { amount_usd?: number; shares?: number; fraction?: number } = {};
  const usd = /\$\s*(\d[\d\s.,]*)|(\d[\d\s.,]*)\s*(\$|usd|dollars?|bucks|доллар\S*|бакс\S*|\bдолл\b)/i.exec(t);
  const sh = /(\d[\d.,]*)\s*(shares?|stocks?|акци\S*|штук\S*|шт\b)/i.exec(t);
  const pc = /(\d{1,3})\s*%/.exec(t);
  if (sh) out.shares = num(sh[1]);
  else if (usd) out.amount_usd = num(usd[1] ?? usd[2]);
  else if (side === 'sell') {
    if (pc) out.fraction = Math.min(1, num(pc[1]) / 100);
    else if (has(t, /half|половин/)) out.fraction = 0.5;
    else if (has(t, /quarter|четверть/)) out.fraction = 0.25;
    else if (has(t, /third|треть/)) out.fraction = 1 / 3;
    else if (has(t, /\ball\b|everything|entire|всё|все|целиком|полностью/)) out.fraction = 1;
  }
  return out;
}

/**
 * Maps a message to one tool call. `focus` holds the tickers the conversation
 * is currently about, so follow-ups like "what about tomorrow?" work.
 */
export function parseIntent(message: string, focus: string[], allowUnknown = false): Intent {
  const t = message.toLowerCase().replace(/ё/g, 'е');
  const mentioned = findSymbols(message, allowUnknown);
  const symbols = mentioned.length ? mentioned : focus.slice(0, 1);
  const first = symbols[0];

  // Hypotheticals come first: "what if I buy…" must not become an order.
  const hypothetical = has(t, /what if|what would happen|what happens if|suppose|что будет.{0,30}если|что случится.{0,30}если|что если|а если|если .*(упад|вырас|просяд|обвал|подорож|подешев|drop|fall|rise|crash)/);
  if (hypothetical && has(t, /\d/) && has(t, /%|percent|процент/)) {
    const pct = /(\d+(?:[.,]\d+)?)\s*(%|percent|процент)/.exec(t);
    const down = has(t, /drop|fall|fell|crash|decline|lose|down|упад|просяд|обвал|снизи|подешев|потеря|минус|-\s*\d/);
    if (pct && first) return { tool: 'what_if', args: { changes: mentioned.length ? mentioned.map((s) => ({ symbol: s, pct: (down ? -1 : 1) * num(pct[1]) })) : [{ symbol: first, pct: (down ? -1 : 1) * num(pct[1]) }] } };
  }

  const buy = has(t, /\b(buy|purchase|invest \$?\d)|купи|купить|куплю|покуп|докуп|приобрет/);
  const sell = has(t, /\bsell\b|прода/);
  if ((buy || sell) && !hypothetical && !has(t, /should i|стоит ли|можно ли|worth/)) {
    const side = sell && !buy ? 'sell' : buy && !sell ? 'buy' : t.search(/\bsell\b|прода/) < t.search(/\bbuy|купи|покуп/) ? 'sell' : 'buy';
    if (!first) return { tool: 'help', args: { reason: 'need_symbol' } };
    const q = parseTrade(t, side);
    if (q.amount_usd === undefined && q.shares === undefined && q.fraction === undefined) return { tool: 'help', args: { reason: 'need_amount' } };
    return { tool: 'propose_trade', args: { side, symbol: first, ...q } };
  }

  const aboutPortfolio = has(t, /portfolio|портфел|my holdings|my positions|мои (акции|позиции|активы)/);
  if (has(t, /how much.{0,20}(cash|money)|cash (left|balance)|\bbalance\b|buying power|сколько.{0,25}(денег|средств|кэш|осталось|налич)|баланс|свободн\S* (деньг|средств)/)) return { tool: 'get_account', args: {} };

  if (has(t, /compare|versus|\bvs\.?\b|сравни|сравнен|против\b/) || (mentioned.length >= 2 && has(t, /\bor\b|или|better|лучше/))) {
    const list = [...new Set([...(mentioned.length >= 2 ? [] : focus.slice(0, 1)), ...mentioned])].slice(0, 4);
    if (list.length >= 2) return { tool: 'compare', args: { symbols: list, range: parseRange(t) ?? undefined } };
    return { tool: 'help', args: { reason: 'need_symbol' } };
  }

  const wantsChart = has(t, /chart|graph|plot|график|диаграмм|динамик/);
  if (aboutPortfolio) {
    if (wantsChart || has(t, /performance|доходност/)) return { tool: 'show_chart', args: { symbols: ['PORTFOLIO'], range: parseRange(t) ?? '1M' } };
    return { tool: 'analyze_portfolio', args: {} };
  }

  const picks = has(t, /which (stocks?|companies|etfs?)|what (stocks?|companies)|stocks? (worth|to (research|watch))|\bpicks?\b|ideas|promising|top \d|show me \d|какие (акции|компании|бумаги|фонды)|что (купить|посмотреть|изучить)|идеи|перспективн|подбери|подбор|покажи \d+ (акци|компан)|топ[ -]?\d/);
  if (picks && !mentioned.length) {
    const count = /\b(\d)\b/.exec(t);
    const horizon = has(t, /long[- ]term|years|долгосроч|на годы|на года|в долгую/) ? 'long' : has(t, /tomorrow|week|short[- ]term|завтра|недел|краткосроч/) ? 'short' : has(t, /month|medium|месяц|среднесроч/) ? 'medium' : 'medium';
    const kind = has(t, /\betfs?\b|фонд/) ? 'etf' : 'any';
    return { tool: 'stock_picks', args: { horizon, count: count ? Math.min(8, Math.max(1, Number(count[1]))) : undefined, kind } };
  }

  if (has(t, /events?|calendar|earnings (date|report|calendar)|событи|календар|отчетност\S* (на|в|завтра)|когда отчет/)) return { tool: 'get_events', args: { symbol: mentioned[0] } };

  const horizon = parseHorizon(t);
  const forecasty = has(t, /forecast|predict|outlook|what (could|might|will) happen|could happen|scenario|прогноз|предска|что (может|будет)|сценари|ожида|what about (tomorrow|next)|а (что )?(завтра|через|на недел|на месяц)/);
  if ((forecasty || horizon) && first && !has(t, /why|почему|news|новост/)) return { tool: 'forecast', args: { symbol: first, horizon: horizon ?? 'week' } };

  if (has(t, /\bwhy\b|news|what happened|headline|почему|новост|что случилось|что произошло|что происходит|из-за чего/)) return { tool: 'get_news', args: { symbol: symbols[0] } };

  if (wantsChart && symbols.length) return { tool: 'show_chart', args: { symbols: symbols.slice(0, 4), range: parseRange(t) ?? '1M' } };

  if (has(t, /analy[sz]|research|report|tell me about|about the company|worth|overview|fundamental|should i|анализ|проанализ|разбер|разбор|расскажи|что за компан|стоит ли|обзор|оцени|изучи/) && first) return { tool: 'analyze_company', args: { symbol: first } };

  if (has(t, /price|quote|how much is|cost|цена|сколько стоит|котировк|курс|почем/) && symbols.length) return { tool: 'show_quotes', args: { symbols: symbols.slice(0, 6) } };

  if (mentioned.length >= 2) return { tool: 'compare', args: { symbols: mentioned.slice(0, 4) } };
  if (mentioned.length === 1) return { tool: 'analyze_company', args: { symbol: mentioned[0] } };
  if (has(t, /^(hi|hello|hey|привет|здравствуй|добрый|хай|help|помощь|что ты умеешь|what can you do)/)) return { tool: 'help', args: { reason: 'greeting' } };
  if (has(t, /market|рынок|рынк/)) return { tool: 'get_news', args: {} };
  return { tool: 'help', args: { reason: 'unknown' } };
}
