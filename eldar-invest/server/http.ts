/** Minimal HTTP helpers shared by all API handlers (Vercel functions and the Vite dev server). */
import type { IncomingMessage, ServerResponse } from 'node:http';

export type Req = IncomingMessage & { body?: unknown };
export type Res = ServerResponse;
export type Handler = (req: Req, res: Res) => Promise<void>;

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
  }
}

export function sendJson(res: Res, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

export async function readJson(req: Req, maxBytes = 200_000): Promise<unknown> {
  if (req.body !== undefined) {
    if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
    return req.body;
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > maxBytes) throw new HttpError(413, 'too_large', 'Request body is too large.');
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw new HttpError(400, 'bad_json', 'Request body is not valid JSON.');
  }
}

export function query(req: Req): URLSearchParams {
  return new URL(req.url ?? '/', 'http://localhost').searchParams;
}

export function clientIp(req: Req): string {
  const fwd = req.headers['x-forwarded-for'];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
  return first || req.socket?.remoteAddress || 'unknown';
}

/** Wraps a handler with uniform error responses. Upstream details never leak secrets. */
export function handle(fn: Handler): Handler {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (e) {
      if (e instanceof HttpError) {
        sendJson(res, e.status, { error: { code: e.code, message: e.message, retryAfter: e.retryAfter } }, e.retryAfter ? { 'Retry-After': String(e.retryAfter) } : {});
      } else {
        console.error('[api]', e);
        sendJson(res, 500, { error: { code: 'internal', message: 'Unexpected server error.' } });
      }
    }
  };
}

/* ------------------------------ TTL cache ------------------------------ */

const cache = new Map<string, { at: number; ttl: number; value: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.value as T;
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;
  const p = load()
    .then((value) => {
      cache.set(key, { at: Date.now(), ttl: ttlMs, value });
      if (cache.size > 2000) cache.delete(cache.keys().next().value as string);
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export function clearCache() {
  cache.clear();
}

/* ----------------------- Best-effort rate limiting ---------------------- */

const buckets = new Map<string, number[]>();

/**
 * Sliding-window limiter kept in memory. On serverless platforms each
 * instance has its own memory, so this is a courtesy limit, not a guarantee;
 * provider-side quotas remain the hard limit.
 */
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const list = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= max) {
    const retry = Math.max(1, Math.ceil((windowMs - (now - list[0])) / 1000));
    buckets.set(key, list);
    throw new HttpError(429, 'rate_limited', 'Too many requests. Please slow down.', retry);
  }
  list.push(now);
  buckets.set(key, list);
  if (buckets.size > 5000) buckets.delete(buckets.keys().next().value as string);
}

/* ------------------------------ Upstream fetch -------------------------- */

export async function upstream(provider: string, url: string, init: RequestInit = {}, timeoutMs = 12_000): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let r: Response;
  try {
    r = await fetch(url, { ...init, signal: ctrl.signal });
  } catch {
    throw new HttpError(502, 'upstream_unreachable', `${provider} did not respond. Try again shortly.`);
  } finally {
    clearTimeout(timer);
  }
  if (r.status === 429) {
    const ra = Number(r.headers.get('retry-after')) || 60;
    throw new HttpError(429, 'provider_rate_limited', `${provider} rate limit reached (free-tier quota). Try again in about ${ra} seconds.`, ra);
  }
  if (r.status === 401 || r.status === 403) {
    throw new HttpError(502, 'provider_denied', `${provider} rejected the request: the API key is invalid or this data is not included in the configured plan.`);
  }
  if (!r.ok) throw new HttpError(502, 'upstream_error', `${provider} returned an error (${r.status}).`);
  try {
    return await r.json();
  } catch {
    throw new HttpError(502, 'upstream_error', `${provider} returned an unreadable response.`);
  }
}

export const env = (name: string): string | undefined => {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
};

export function validSymbol(raw: string | null): string {
  const s = (raw ?? '').trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9.\-]{0,6}$/.test(s)) throw new HttpError(400, 'bad_symbol', 'Invalid ticker symbol.');
  return s;
}
