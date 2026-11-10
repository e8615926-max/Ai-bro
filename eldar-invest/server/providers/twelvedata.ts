/**
 * Twelve Data adapter (https://twelvedata.com). Free "Basic" plan: 8 API
 * credits/minute and 800/day, for personal, internal, non-display use.
 * Used for historical price series (one credit per request).
 */
import { cached, env, HttpError, upstream } from '../http.js';
import type { HistoryDTO } from './types.js';

const NAME = 'Twelve Data';
const base = () => env('TWELVEDATA_API_BASE') ?? 'https://api.twelvedata.com';
export const twelveDataEnabled = () => !!env('TWELVEDATA_API_KEY');

const SPEC: Record<string, { interval: string; size: number; ttl: number }> = {
  '1D': { interval: '5min', size: 78, ttl: 5 * 60_000 },
  '1W': { interval: '30min', size: 70, ttl: 15 * 60_000 },
  '1M': { interval: '1day', size: 23, ttl: 3600_000 },
  '6M': { interval: '1day', size: 128, ttl: 6 * 3600_000 },
  '1Y': { interval: '1day', size: 253, ttl: 6 * 3600_000 },
  '5Y': { interval: '1week', size: 262, ttl: 24 * 3600_000 },
  /** ~400 daily closes for indicators and forecasts. */
  D400: { interval: '1day', size: 400, ttl: 6 * 3600_000 },
};

export const HISTORY_RANGES = Object.keys(SPEC);

export function history(symbol: string, range: string): Promise<HistoryDTO> {
  const spec = SPEC[range];
  if (!spec) throw new HttpError(400, 'bad_range', 'Unsupported chart range.');
  return cached(`td:h:${symbol}:${range}`, spec.ttl, async () => {
    const qs = new URLSearchParams({ symbol, interval: spec.interval, outputsize: String(spec.size), order: 'ASC', timezone: 'UTC' });
    const d = (await upstream(NAME, `${base()}/time_series?${qs}`, { headers: { Authorization: `apikey ${env('TWELVEDATA_API_KEY')}` } })) as {
      status?: string;
      code?: number;
      message?: string;
      values?: { datetime: string; close: string }[];
    };
    // Twelve Data reports errors (including quota) inside a 200 response.
    if (d.status === 'error' || !Array.isArray(d.values)) {
      if (d.code === 429) throw new HttpError(429, 'provider_rate_limited', `${NAME} free-tier quota reached (8 requests/minute, 800/day). Try again in a minute.`, 60);
      if (d.code === 401 || d.code === 403) throw new HttpError(502, 'provider_denied', `${NAME} rejected the request: check the API key or plan.`);
      if (d.code === 404 || d.code === 400) throw new HttpError(404, 'no_data', `No price history is available for ${symbol}.`);
      throw new HttpError(502, 'upstream_error', `${NAME} returned an error.`);
    }
    const points = d.values
      .map((v) => ({ t: Date.parse(v.datetime.length <= 10 ? `${v.datetime}T21:00:00Z` : `${v.datetime.replace(' ', 'T')}Z`), v: Number(v.close) }))
      .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v) && p.v > 0);
    if (points.length < 2) throw new HttpError(404, 'no_data', `No price history is available for ${symbol}.`);
    return { symbol, interval: spec.interval, points, source: NAME, asOf: points[points.length - 1].t };
  });
}

export const TWELVEDATA_NAME = NAME;
