/**
 * /api/market — real market data for ELDAR AI. API keys stay on the server;
 * the browser only ever sees normalised JSON with `source` and `asOf`.
 */
import type { BackendStatus } from '../shared/aiTools.js';
import { CATALOG } from './catalog.js';
import { clientIp, handle, HttpError, query, rateLimit, sendJson, validSymbol } from './http.js';
import * as edgar from './providers/edgar.js';
import * as finnhub from './providers/finnhub.js';
import * as twelve from './providers/twelvedata.js';

export function marketStatus(): BackendStatus['market'] {
  const fh = finnhub.finnhubEnabled() ? finnhub.FINNHUB_NAME : null;
  return {
    quotes: fh,
    history: twelve.twelveDataEnabled() ? twelve.TWELVEDATA_NAME : null,
    fundamentals: fh,
    news: fh,
    filings: fh && edgar.edgarEnabled() ? edgar.EDGAR_NAME : null,
  };
}

function need(ok: boolean, what: string) {
  if (!ok) throw new HttpError(501, 'not_configured', `${what} is not configured on this server.`);
}

/** Runs tasks with limited concurrency to stay inside per-second provider caps. */
async function pool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

export const marketHandler = handle(async (req, res) => {
  if (req.method !== 'GET') throw new HttpError(405, 'method', 'Use GET.');
  rateLimit(`m:${clientIp(req)}`, 90, 60_000);
  const q = query(req);
  const op = q.get('op');

  switch (op) {
    case 'quote': {
      need(finnhub.finnhubEnabled(), 'A quote provider');
      const symbols = (q.get('symbols') ?? '').split(',').filter(Boolean).slice(0, 8).map(validSymbol);
      if (!symbols.length) throw new HttpError(400, 'bad_request', 'symbols is required.');
      const quotes = await Promise.all(symbols.map((s) => finnhub.quote(s)));
      return sendJson(res, 200, { quotes: quotes.filter(Boolean), missing: symbols.filter((_, i) => !quotes[i]) });
    }
    case 'history': {
      need(twelve.twelveDataEnabled(), 'A price-history provider');
      return sendJson(res, 200, await twelve.history(validSymbol(q.get('symbol')), q.get('range') ?? ''));
    }
    case 'profile': {
      need(finnhub.finnhubEnabled(), 'A company-profile provider');
      return sendJson(res, 200, { profile: await finnhub.profile(validSymbol(q.get('symbol'))) });
    }
    case 'metrics': {
      need(finnhub.finnhubEnabled(), 'A fundamentals provider');
      return sendJson(res, 200, { metrics: await finnhub.metrics(validSymbol(q.get('symbol'))) });
    }
    case 'filings': {
      need(finnhub.finnhubEnabled() && edgar.edgarEnabled(), 'The filings provider');
      return sendJson(res, 200, { filings: await edgar.filings(validSymbol(q.get('symbol'))) });
    }
    case 'news': {
      need(finnhub.finnhubEnabled(), 'A news provider');
      const s = q.get('symbol');
      const items = s ? await finnhub.companyNews(validSymbol(s)) : await finnhub.marketNews();
      return sendJson(res, 200, { items, source: finnhub.FINNHUB_NAME, asOf: Date.now() });
    }
    case 'events': {
      need(finnhub.finnhubEnabled(), 'An events provider');
      const days = Math.min(14, Math.max(1, Number(q.get('days')) || 7));
      const s = q.get('symbol');
      const all = await finnhub.earningsCalendar(days, s ? validSymbol(s) : undefined);
      const items = (s ? all : all.filter((e) => CATALOG.includes(e.symbol))).slice(0, 40);
      return sendJson(res, 200, { items, source: finnhub.FINNHUB_NAME, asOf: Date.now() });
    }
    case 'screen': {
      // One metrics call per catalogue symbol (cached 12h), a few at a time.
      need(finnhub.finnhubEnabled(), 'A fundamentals provider');
      const rows = await pool(CATALOG, 4, (s) => finnhub.metrics(s).catch((e) => {
        if (e instanceof HttpError && e.status === 429) throw e;
        return null;
      }));
      return sendJson(res, 200, { rows: rows.filter(Boolean), source: finnhub.FINNHUB_NAME, asOf: Date.now() });
    }
    default:
      throw new HttpError(400, 'bad_op', 'Unknown operation.');
  }
});
