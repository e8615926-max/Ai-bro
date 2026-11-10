/** Finds tickers mentioned in free text (English and Russian). */
import { ASSETS } from '@/data/assets';

/** Lower-case stems; a stem matches at the start of a word. */
const ALIASES: Record<string, string[]> = {
  AAPL: ['apple', 'эпл', 'эппл', 'апл', 'яблок'],
  MSFT: ['microsoft', 'майкрософт', 'микрософт'],
  NVDA: ['nvidia', 'нвиди', 'энвиди', 'инвиди'],
  AMD: ['advanced micro', 'амд'],
  ASML: ['асмл'],
  ADBE: ['adobe', 'адоб'],
  GOOGL: ['alphabet', 'google', 'гугл', 'альфабет', 'goog'],
  META: ['meta', 'facebook', 'мета', 'фейсбук'],
  NFLX: ['netflix', 'нетфликс'],
  SPOT: ['spotify', 'спотифай'],
  AMZN: ['amazon', 'амазон'],
  TSLA: ['tesla', 'тесл'],
  NKE: ['nike', 'найк'],
  KO: ['coca', 'coke', 'кока', 'кола'],
  MCD: ['mcdonald', 'макдональд', 'макдоналд'],
  JNJ: ['johnson', 'джонсон'],
  LLY: ['eli lilly', 'lilly', 'лилли', 'лили'],
  PFE: ['pfizer', 'пфайзер', 'файзер'],
  JPM: ['jpmorgan', 'jp morgan', 'джпморган', 'джей пи морган'],
  V: ['visa', 'виза', 'визу', 'визы'],
  MA: ['mastercard', 'мастеркард'],
  GS: ['goldman', 'голдман'],
  XOM: ['exxon', 'эксон', 'экссон'],
  CVX: ['chevron', 'шеврон'],
  NEE: ['nextera', 'некстэра', 'некстера'],
  BA: ['boeing', 'боинг'],
  CAT: ['caterpillar', 'катерпиллар', 'катерпилар'],
  GE: ['ge aerospace', 'general electric', 'дженерал электрик'],
  SPY: ['s&p', 's & p', 'sp500', 'сп500', 'эс энд пи'],
  QQQ: ['nasdaq', 'насдак', 'наздак'],
  VTI: ['total stock market'],
  VXUS: ['international stock'],
  BND: ['bond', 'облигац'],
  GLD: ['gold', 'золот'],
};

const TICKERS = new Set(ASSETS.map((a) => a.symbol));
/** Tickers that are also ordinary words; only accepted in upper case or with a $ prefix. */
const AMBIGUOUS = new Set(['V', 'MA', 'GE', 'BA', 'KO', 'CAT', 'META', 'SPOT', 'GS']);
const STOP = new Set(['I', 'A', 'AI', 'ETF', 'USD', 'RSI', 'SMA', 'PE', 'EPS', 'CEO', 'IPO', 'OK', 'US', 'USA', 'ELDAR', 'INVEST', 'P', 'L']);

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Returns catalogue tickers in order of appearance. With `allowUnknown`,
 * explicit `$XYZ` or upper-case tickers outside the catalogue are kept too
 * (useful when real market data is connected).
 */
export function findSymbols(text: string, allowUnknown = false): string[] {
  const found: { i: number; s: string }[] = [];
  const lower = text.toLowerCase();
  for (const [symbol, stems] of Object.entries(ALIASES)) {
    for (const stem of stems) {
      const m = new RegExp(`(^|[^a-zа-яё0-9])${esc(stem)}`, 'i').exec(lower);
      if (m) {
        found.push({ i: m.index + m[1].length, s: symbol });
        break;
      }
    }
  }
  const re = /(\$)?\b([A-Za-z]{1,5})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const raw = m[2];
    const up = raw.toUpperCase();
    const explicit = !!m[1] || raw === up;
    if (STOP.has(up) && !m[1]) continue;
    if (TICKERS.has(up)) {
      if (AMBIGUOUS.has(up) && !explicit) continue;
      if (!explicit && up.length < 3) continue;
      found.push({ i: m.index, s: up });
    } else if (allowUnknown && (m[1] || (raw === up && raw.length >= 2 && raw.length <= 5 && /[A-Z]{2,5}/.test(raw)))) {
      found.push({ i: m.index, s: up });
    }
  }
  const out: string[] = [];
  for (const f of found.sort((a, b) => a.i - b.i)) if (!out.includes(f.s)) out.push(f.s);
  return out;
}
