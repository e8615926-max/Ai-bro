/**
 * Local stand-ins for Gemini, Finnhub, Twelve Data and SEC EDGAR, used only by
 * the automated tests (scripts/e2e-ai.mjs). They return clearly fake data
 * ("Mock ..."), check that the server sends the API keys, and let the tests
 * exercise rate-limit and error paths without touching real services.
 */
import http from 'node:http';

export const MOCK_KEYS = { gemini: 'test-gemini-key', finnhub: 'test-finnhub-key', twelve: 'test-twelve-key' };
export const seen = { geminiCalls: 0, missingSignature: 0, toolsDeclared: 0, systemPrompt: '' };

const json = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'content-type': 'application/json', ...headers });
  res.end(JSON.stringify(body));
};

function gemini(req, res, url, body) {
  if (req.headers['x-goog-api-key'] !== MOCK_KEYS.gemini) return json(res, 403, { error: { message: 'bad key' } });
  if (req.method === 'GET') {
    return json(res, 200, { models: [
      { name: 'models/gemini-9.1-flash', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-9.9-flash-preview-tts', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-8.0-flash', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-9.5-pro', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/embedding-9', supportedGenerationMethods: ['embedContent'] },
    ] });
  }
  seen.geminiCalls++;
  seen.toolsDeclared = body.tools?.[0]?.functionDeclarations?.length ?? 0;
  seen.systemPrompt = body.systemInstruction?.parts?.[0]?.text ?? '';
  const contents = body.contents ?? [];
  const last = contents[contents.length - 1];
  const lastUserText = [...contents].reverse().find((c) => c.role === 'user' && c.parts.some((p) => p.text))?.parts.find((p) => p.text)?.text ?? '';
  const reply = (parts) => json(res, 200, { candidates: [{ content: { role: 'model', parts }, finishReason: 'STOP' }], usageMetadata: { totalTokenCount: 123 } });
  if (/QUOTA/.test(lastUserText)) return json(res, 429, { error: { code: 429, message: 'quota', details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '37s' }] } });
  if (/OVERLOAD/.test(lastUserText)) return json(res, 503, { error: { message: 'overloaded' } });
  if (last.parts.some((p) => p.functionResponse)) {
    // Like real Gemini 3+, reject the request if the thought signature was not echoed back.
    const prev = contents[contents.length - 2];
    if (!prev?.parts.some((p) => p.thoughtSignature === 'mock-signature')) {
      seen.missingSignature++;
      return json(res, 400, { error: { message: 'missing thought signature' } });
    }
    const r = last.parts.find((p) => p.functionResponse).functionResponse;
    return reply([{ text: `MOCK-FINAL after ${r.name}: **interpretation** based on tool data.\n- point one\n- point two` }]);
  }
  const call = (name, args) => reply([{ functionCall: { name, args, id: 'call-1' }, thoughtSignature: 'mock-signature' }]);
  if (/buy/i.test(lastUserText)) return call('propose_trade', { side: 'buy', symbol: 'TSLA', amount_usd: 500 });
  if (/tomorrow/i.test(lastUserText)) return call('forecast', { symbol: 'NVDA', horizon: 'day' });
  if (/news|why/i.test(lastUserText)) return call('get_news', { symbol: 'TSLA' });
  if (/compare/i.test(lastUserText)) return call('compare', { symbols: ['TSLA', 'NVDA'] });
  if (/analy/i.test(lastUserText)) return call('analyze_company', { symbol: 'NVDA' });
  return reply([{ text: 'MOCK-TEXT plain answer.' }]);
}

function finnhub(req, res, url) {
  if (req.headers['x-finnhub-token'] !== MOCK_KEYS.finnhub) return json(res, 401, { error: 'bad key' });
  const symbol = url.searchParams.get('symbol') ?? '';
  const path = url.pathname.replace('/fh', '');
  const now = Math.floor(Date.now() / 1000);
  if (path === '/quote') return symbol === 'ZZZZ' ? json(res, 200, { c: 0, d: null, dp: null, h: 0, l: 0, o: 0, pc: 0, t: 0 }) : json(res, 200, { c: 150.25, d: 2.25, dp: 1.52, h: 151, l: 147.5, o: 148, pc: 148, t: now - 60 });
  if (path === '/stock/profile2') return json(res, 200, { name: `Mock ${symbol} Corp`, ticker: symbol, logo: '', finnhubIndustry: 'Mock Industry', exchange: 'MOCK EXCHANGE', country: 'US', currency: 'USD', marketCapitalization: 2500000, ipo: '1999-01-22', weburl: 'https://example.com/' });
  if (path === '/stock/metric') return json(res, 200, { metric: { peTTM: 31.4, epsTTM: 4.78, beta: 1.6, '52WeekHigh': 180, '52WeekLow': 90, '5DayPriceReturnDaily': 1.2, '13WeekPriceReturnDaily': 8.5 + symbol.length, '26WeekPriceReturnDaily': 15.1, '52WeekPriceReturnDaily': 40.2, revenueGrowthTTMYoy: 22.5 + symbol.charCodeAt(0) % 9, epsGrowthTTMYoy: 30.1, netProfitMarginTTM: 25.3, grossMarginTTM: 60.2, roeTTM: 35 + symbol.charCodeAt(1) % 20, 'totalDebt/totalEquityQuarterly': 0.41, currentRatioQuarterly: 2.1, dividendYieldIndicatedAnnual: 0.5 } });
  if (path === '/stock/earnings') return json(res, 200, [{ period: '2026-09-30', actual: 1.3, estimate: 1.21, surprisePercent: 7.4 }, { period: '2026-06-30', actual: 1.1, estimate: 1.12, surprisePercent: -1.8 }]);
  if (path === '/company-news') return json(res, 200, [{ headline: `Mock headline about ${symbol}`, source: 'Mock Newswire', url: 'https://example.com/news/1', datetime: now - 3600, summary: 'Mock summary of the article.', related: symbol }, { headline: 'javascript link must be dropped', source: 'x', url: 'javascript:alert(1)', datetime: now, summary: '' }]);
  if (path === '/news') return json(res, 200, [{ headline: 'Mock market headline', source: 'Mock Times', url: 'https://example.com/news/2', datetime: now - 7200, summary: 'Markets did things.' }]);
  if (path === '/calendar/earnings') return json(res, 200, { earningsCalendar: [{ symbol: 'NVDA', date: '2026-11-19', hour: 'amc', epsEstimate: 1.4, revenueEstimate: 5e10 }] });
  return json(res, 404, {});
}

function twelve(req, res, url) {
  if (req.headers.authorization !== `apikey ${MOCK_KEYS.twelve}`) return json(res, 200, { status: 'error', code: 401, message: 'bad key' });
  const symbol = url.searchParams.get('symbol');
  if (symbol === 'RATE') return json(res, 200, { status: 'error', code: 429, message: 'You have run out of API credits for the current minute.' });
  const n = Number(url.searchParams.get('outputsize')) || 30;
  const interval = url.searchParams.get('interval');
  const stepMs = interval === '5min' ? 300e3 : interval === '30min' ? 1800e3 : interval === '1week' ? 7 * 86400e3 : 86400e3;
  const values = Array.from({ length: n }, (_, i) => {
    const t = new Date(Date.now() - (n - i) * stepMs).toISOString();
    return { datetime: stepMs >= 86400e3 ? t.slice(0, 10) : t.slice(0, 19).replace('T', ' '), close: (100 + 50 * (i / n) + 4 * Math.sin(i / 5)).toFixed(4) };
  });
  return json(res, 200, { meta: { symbol }, values, status: 'ok' });
}

function sec(req, res, url) {
  if (!String(req.headers['user-agent']).includes('ELDAR')) return json(res, 403, {});
  if (url.pathname.endsWith('company_tickers.json')) return json(res, 200, { 0: { cik_str: 1045810, ticker: 'NVDA', title: 'Mock NVDA' }, 1: { cik_str: 1318605, ticker: 'TSLA', title: 'Mock TSLA' } });
  const fact = (val, fy, extra = {}) => ({ start: `${fy - 1}-02-01`, end: `${fy}-01-31`, val, fy, fp: 'FY', form: '10-K', filed: `${fy}-03-01`, ...extra });
  const inst = (val, fy) => ({ end: `${fy}-01-31`, val, fy, fp: 'FY', form: '10-K', filed: `${fy}-03-01` });
  return json(res, 200, { entityName: 'Mock Corp', facts: { 'us-gaap': {
    Revenues: { units: { USD: [fact(60e9, 2025), fact(130e9, 2026), { start: '2025-11-01', end: '2026-01-31', val: 39e9, fy: 2026, fp: 'Q4', form: '10-K', filed: '2026-03-01' }] } },
    NetIncomeLoss: { units: { USD: [fact(29e9, 2025), fact(72e9, 2026)] } },
    Assets: { units: { USD: [inst(111e9, 2026)] } },
    Liabilities: { units: { USD: [inst(32e9, 2026)] } },
    StockholdersEquity: { units: { USD: [inst(79e9, 2026)] } },
    CashAndCashEquivalentsAtCarryingValue: { units: { USD: [inst(8.5e9, 2026)] } },
    LongTermDebtNoncurrent: { units: { USD: [inst(8.4e9, 2026)] } },
  } } });
}

export function startMocks(port) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : {};
      if (url.pathname.startsWith('/v1beta/')) return gemini(req, res, url, body);
      if (url.pathname.startsWith('/fh/')) return finnhub(req, res, url);
      if (url.pathname.startsWith('/td/')) return twelve(req, res, url);
      if (url.pathname.startsWith('/sec')) return sec(req, res, url);
      json(res, 404, {});
    });
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

export const mockEnv = (port) => ({
  GEMINI_API_KEY: MOCK_KEYS.gemini,
  GEMINI_API_BASE: `http://localhost:${port}`,
  FINNHUB_API_KEY: MOCK_KEYS.finnhub,
  FINNHUB_API_BASE: `http://localhost:${port}/fh`,
  TWELVEDATA_API_KEY: MOCK_KEYS.twelve,
  TWELVEDATA_API_BASE: `http://localhost:${port}/td`,
  SEC_FILES_BASE: `http://localhost:${port}/sec`,
  SEC_DATA_BASE: `http://localhost:${port}/secdata`,
});
