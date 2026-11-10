/**
 * End-to-end tests for ELDAR AI.
 *   Phase A — no server keys: built-in analyst on demo data (RU + EN, phone + desktop).
 *   Phase B — keys set, upstreams mocked: Gemini tool-calling loop, real-data
 *             cards with sources, confirmation flow, rate-limit fallback,
 *             API validation, and a check that no key reaches the browser.
 * Usage: npm run build && npm run e2e:ai     (SHOTS=dir saves screenshots)
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { MOCK_KEYS, mockEnv, seen, startMocks } from './mock-upstreams.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const SHOTS = process.env.SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const results = [];
const errors = [];
const step = async (name, fn) => {
  try {
    await fn();
    results.push(['PASS', name]);
  } catch (e) {
    results.push(['FAIL', name, String(e.message).split('\n')[0]]);
  }
};
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

async function preview(port, env = {}) {
  const proc = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'pipe', detached: true, env: { ...process.env, ...env } });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('preview did not start')), 20000);
    proc.stdout.on('data', (d) => d.toString().includes('localhost') && (clearTimeout(t), resolve()));
  });
  return () => {
    try {
      process.kill(-proc.pid);
    } catch {
      /* gone */
    }
  };
}

async function signedInPage(browser, base, viewport, label, locale) {
  const ctx = await browser.newContext({ viewport, locale, deviceScaleFactor: SHOTS ? 2 : 1 });
  const page = await ctx.newPage();
  page.setDefaultTimeout(12000);
  page.on('pageerror', (e) => errors.push(`[${label}] ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !/status of (429|50\d|400|404)/.test(m.text()) && errors.push(`[${label}] ${m.text().slice(0, 200)}`));
  await page.goto(base + '/register');
  await page.getByLabel('Full name').fill('Alex Morgan');
  await page.getByLabel('Email').fill(`ai${Date.now()}${label}@example.com`);
  await page.getByLabel('Password', { exact: true }).fill('Secure123!');
  await page.getByText('I understand ELDAR INVEST').click();
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByText('Total portfolio value').waitFor();
  return page;
}

function chat(page, label) {
  const last = () => page.getByTestId('ai-message').last();
  return {
    last,
    async ask(q) {
      const before = await page.getByTestId('ai-message').count();
      await page.getByRole('textbox').fill(q);
      await page.keyboard.press('Enter');
      await page.waitForFunction((n) => document.querySelectorAll('[data-testid=ai-message]').length > n && !document.querySelector('[data-testid=ai-message] .animate-bounce'), before, { timeout: 25000 });
      await page.waitForTimeout(250);
    },
    /** Scrolls to the end of the chat (as a user would) so sticky UI never covers the newest card. */
    async bottom() {
      await page.waitForTimeout(600);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    },
    async shot(name) {
      if (SHOTS) await last().screenshot({ path: `${SHOTS}/${label}-${name}.png` });
    },
  };
}

const browser = await chromium.launch();

/* ------------------------------- Phase A -------------------------------- */
{
  const stop = await preview(4174);
  const base = 'http://localhost:4174';
  for (const [label, viewport, locale] of [
    ['local-phone-ru', { width: 390, height: 844 }, 'ru-RU'],
    ['local-desktop-en', { width: 1440, height: 900 }, 'en-US'],
  ]) {
    const ru = locale === 'ru-RU';
    const page = await signedInPage(browser, base, viewport, label, locale);
    const c = chat(page, label);
    const T = (r, e) => (ru ? r : e);

    await step(`${label}: AI tab opens from navigation in the right language`, async () => {
      await page.getByRole('link', { name: 'ELDAR AI' }).last().click();
      await page.getByRole('heading', { name: 'ELDAR AI' }).waitFor();
      await page.getByText(T('Встроенный аналитик', 'Built-in analyst')).first().waitFor();
      await page.getByText(T('Демо-данные', 'Demo data')).first().waitFor();
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/${label}-home.png`, fullPage: true });
    });

    await step(`${label}: company analysis with chart and demo labels`, async () => {
      await c.ask(T('Проанализируй NVIDIA', 'Analyze NVIDIA'));
      await c.last().getByText(T('Отчёт о компании', 'Company report')).waitFor();
      await c.last().getByRole('img', { name: /NVDA 6M/ }).waitFor();
      assert((await c.last().getByText(T('Демо-данные', 'Demo data')).count()) >= 2, 'demo badges missing');
      await c.last().getByText(/ELDAR INVEST simulator/).first().waitFor();
      await c.shot('company');
    });

    await step(`${label}: follow-up "tomorrow" keeps context → scenario forecast`, async () => {
      await c.ask(T('А что завтра?', 'What about tomorrow?'));
      await c.last().getByText(/NVIDIA/).first().waitFor();
      for (const s of T(['Позитивный', 'Нейтральный', 'Негативный', 'Оценочный диапазон', 'Главные риски', 'Уверенность модели', 'Качество данных'], ['Bullish', 'Neutral', 'Bearish', 'Estimated range', 'Main risks', 'Model confidence', 'Data quality'])) await c.last().getByText(s, { exact: true }).first().waitFor();
      await c.last().getByText(T('Симуляция (демо)', 'Simulated (demo)')).waitFor();
      await c.shot('forecast');
    });

    await step(`${label}: "compare it with Microsoft" → chart + metrics table`, async () => {
      await c.ask(T('Сравни с Майкрософт', 'Compare it with Microsoft'));
      await c.last().getByRole('img', { name: /NVDA, MSFT/ }).waitFor();
      await c.last().getByRole('table').waitFor();
      await c.last().getByRole('columnheader', { name: /MSFT/ }).waitFor();
      await c.shot('compare');
    });

    await step(`${label}: chart range switch inside the chat`, async () => {
      await c.last().getByRole('radio', { name: '1Y' }).click();
      await c.last().getByRole('img', { name: /NVDA, MSFT 1Y/ }).waitFor();
      await c.last().getByRole('radio', { name: '1D' }).click();
      await c.last().getByRole('img', { name: /NVDA, MSFT 1D/ }).waitFor();
    });

    await step(`${label}: portfolio analysis uses real holdings`, async () => {
      await c.ask(T('Проанализируй мой портфель', 'Analyze my portfolio'));
      for (const s of T(['Разбор портфеля', 'Распределение риска', 'Сильные стороны', 'Идеи для диверсификации'], ['Portfolio review', 'Risk allocation', 'Strengths', 'Diversification ideas'])) await c.last().getByText(s, { exact: true }).waitFor();
      await c.last().getByText('SPY').first().waitFor();
      await c.shot('portfolio');
    });

    await step(`${label}: cash question`, async () => {
      await c.ask(T('Сколько у меня осталось денег?', 'How much virtual cash do I have left?'));
      await c.last().getByText('$43,500.00').first().waitFor();
    });

    await step(`${label}: what-if simulation`, async () => {
      await c.ask(T('Что будет с портфелем, если NVIDIA упадёт на 10%?', 'What would happen to my portfolio if NVIDIA dropped by 10%?'));
      await c.last().getByText(T('Симуляция «что если»', 'What-if simulation')).waitFor();
      await c.last().getByText('−10%').first().waitFor();
    });

    await step(`${label}: trade needs explicit confirmation; cancel trades nothing`, async () => {
      await c.ask(T('Купи Tesla на $500', 'Buy $500 of Tesla'));
      await c.last().getByText(T('Подтвердите виртуальную покупку', 'Confirm virtual purchase')).waitFor();
      await c.last().getByText('$500.00').first().waitFor();
      await page.goto(base + '/portfolio');
      await page.getByText('Holdings (7)').waitFor();
      await page.goto(base + '/ai');
      await c.last().getByText(T('Подтвердите виртуальную покупку', 'Confirm virtual purchase')).waitFor();
      await c.bottom();
      await c.last().getByRole('button', { name: T('Отмена', 'Cancel') }).click();
      await c.last().getByText(T('Заявка отменена', 'Order cancelled'), { exact: false }).waitFor();
    });

    await step(`${label}: confirmed buy executes and updates the portfolio`, async () => {
      await c.ask(T('Купи Tesla на $500', 'Buy $500 of Tesla'));
      await c.shot('trade');
      await c.last().getByRole('button', { name: T('Подтвердить', 'Confirm') }).click();
      await c.last().getByText(T(/Куплено .* TSLA на \$500\.00/, /Bought .* TSLA for \$500\.00/)).waitFor();
      await c.ask(T('Продай половину Tesla', 'Sell half of my Tesla shares'));
      await c.last().getByText(T('Подтвердите виртуальную продажу', 'Confirm virtual sale')).waitFor();
      await c.last().getByRole('button', { name: T('Подтвердить', 'Confirm') }).click();
      await c.last().getByText(T(/Продано/, /Sold/)).waitFor();
      await page.goto(base + '/activity');
      await page.getByText('Bought TSLA').first().waitFor();
      await page.getByText('Sold TSLA').first().waitFor();
      await page.goto(base + '/ai');
    });

    await step(`${label}: invalid orders are refused with a reason`, async () => {
      await c.ask(T('Купи Apple на $9999999', 'Buy $9999999 of Apple'));
      await c.last().getByText(T(/Не хватает виртуальных денег/, /Not enough virtual cash/)).waitFor();
      await c.ask(T('Продай 5 акций Boeing', 'Sell 5 shares of Boeing'));
      await c.last().getByText(T(/У вас нет BA/, /You do not own BA/)).waitFor();
      assert((await c.last().getByRole('button', { name: T('Подтвердить', 'Confirm') }).count()) === 0, 'confirm shown for invalid order');
    });

    await step(`${label}: stock picks in chat`, async () => {
      await c.ask(T('Покажи 5 акций для изучения', 'Show me 5 stocks worth researching'));
      assert((await c.last().getByText(T('Почему выбрана', 'Why it was selected')).count()) === 5, 'expected 5 picks');
      await c.last().getByText(T(/не рекомендация покупать/, /Not a recommendation to buy/)).waitFor();
      await c.shot('picks');
    });

    await step(`${label}: news in demo mode is refused honestly, not invented`, async () => {
      await c.ask(T('Почему Tesla падает сегодня?', 'Why is Tesla falling today?'));
      await c.last().getByText(T(/Выдумывать новости я не буду/, /I will not invent news/)).waitFor();
    });

    await step(`${label}: history survives reload and can be continued`, async () => {
      await page.reload();
      await page.getByRole('heading', { name: 'ELDAR AI' }).waitFor();
      // The conversation in progress is reopened automatically after a reload.
      await page.getByText(T(/Выдумывать новости я не буду/, /I will not invent news/)).waitFor();
      await page.getByRole('button', { name: T('Новый чат', 'New chat') }).first().click();
      await page.getByText(T('Что хотите узнать?', 'What would you like to explore?')).waitFor();
      const wide = viewport.width >= 1280;
      if (!wide) await page.getByRole('button', { name: T('История', 'History') }).click();
      await (wide ? page.locator('aside') : page.getByRole('dialog')).getByRole('button', { name: T(/Проанализируй NVIDIA/, /Analyze NVIDIA/) }).first().click();
      await page.getByText(T('Отчёт о компании', 'Company report')).first().waitFor();
      await c.ask(T('Покажи график за год', 'Show the 1Y chart'));
      await c.last().getByRole('img', { name: /1Y/ }).waitFor();
    });

    await step(`${label}: Stock Picks section with horizons`, async () => {
      await page.getByRole('tab', { name: T('Подборка акций', 'Stock Picks') }).click();
      await page.getByText(T('Почему выбрана', 'Why it was selected')).first().waitFor();
      const first = await page.locator('.num').first().textContent();
      await page.getByRole('radio', { name: T(/Долгосрочно/, /Long-term/) }).click();
      await page.waitForTimeout(600);
      await page.getByRole('radio', { name: 'ETF' }).click();
      await page.getByText(/· ETF/).first().waitFor();
      await page.waitForTimeout(600);
      assert(first !== null, 'no picks rendered');
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/${label}-pickspage.png`, fullPage: true });
      await page.getByRole('button', { name: T('Спросить ИИ', 'Ask ELDAR AI') }).first().click();
      await page.getByText(T('Отчёт о компании', 'Company report')).first().waitFor();
    });

    await step(`${label}: language switch and no horizontal overflow`, async () => {
      await page.getByRole('radio', { name: ru ? 'en' : 'ru' }).click();
      await page.getByRole('tab', { name: ru ? 'Stock Picks' : 'Подборка акций' }).waitFor();
      for (const p of ['/ai', '/ai/picks']) {
        await page.goto(base + p);
        await page.waitForTimeout(500);
        const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        assert(over <= 1, `${p} overflows by ${over}px`);
      }
    });
    await page.context().close();
  }
  stop();
}

/* ------------------------------- Phase B -------------------------------- */
{
  const mocks = await startMocks(4991);
  const stop = await preview(4175, { ...mockEnv(4991), AI_RATE_PER_MINUTE: '40' });
  const base = 'http://localhost:4175';
  const label = 'gemini-real';
  const bodies = [];
  const page = await signedInPage(browser, base, { width: 1280, height: 900 }, label, 'en-US');
  page.on('response', async (r) => {
    if (r.url().includes('/api/') || r.url().endsWith('.js')) bodies.push(await r.text().catch(() => ''));
  });
  const c = chat(page, label);

  await step(`${label}: status reports Gemini model (auto-discovered) and providers, no secrets`, async () => {
    const s = await (await fetch(base + '/api/status')).json();
    assert(s.ai.enabled && s.ai.model === 'gemini-9.1-flash', `model ${JSON.stringify(s.ai)}`);
    assert(s.market.quotes === 'Finnhub' && s.market.history === 'Twelve Data' && s.market.filings === 'SEC EDGAR', JSON.stringify(s.market));
    assert(!JSON.stringify(s).includes('test-'), 'secret in status');
    await page.goto(base + '/ai');
    await page.getByText('Gemini AI').first().waitFor();
    await page.getByText('Real market data').first().waitFor();
  });

  await step(`${label}: Gemini tool call → real-data company report with sources and timestamps`, async () => {
    await c.ask('Analyze NVIDIA please');
    await c.last().getByText('Mock NVDA Corp').first().waitFor();
    await c.last().getByText('$150.25').first().waitFor();
    await c.last().getByText('Latest annual results', { exact: false }).waitFor();
    await c.last().getByText('$130.0B').waitFor();
    await c.last().getByText('+116.7%').waitFor();
    await c.last().getByText(/SEC EDGAR \(Form 10-K\)/).waitFor();
    await c.last().getByText(/Source: Finnhub/).first().waitFor();
    await c.last().getByText(/Source: Twelve Data/).first().waitFor();
    await c.last().getByText('Mock headline about NVDA').waitFor();
    assert((await c.last().getByText('javascript link must be dropped').count()) === 0, 'unsafe link rendered');
    await c.last().getByText(/MOCK-FINAL after analyze_company/).waitFor();
    await c.last().getByText('Real data').first().waitFor();
    assert(seen.missingSignature === 0, 'thought signature was not echoed to Gemini');
    assert(seen.toolsDeclared === 12, `tools declared: ${seen.toolsDeclared}`);
    assert(/Never invent/.test(seen.systemPrompt) && /REAL market data/.test(seen.systemPrompt) && /"cash":43500/.test(seen.systemPrompt), 'system prompt incomplete');
    await c.shot('company');
  });

  await step(`${label}: forecast on real history: quality "good", earnings risk from calendar`, async () => {
    await c.ask('What about tomorrow?');
    await c.last().getByText('Scenario forecast', { exact: false }).waitFor();
    await c.last().getByText('Good: 1+ year of real daily prices').waitFor();
    await c.last().getByText(/Earnings report expected on 2026-11-19/).waitFor();
    await c.last().getByText('Medium', { exact: true }).waitFor();
    await c.shot('forecast');
  });

  await step(`${label}: news card shows headline, source, date and link`, async () => {
    await c.ask('Why is Tesla moving? any news');
    const link = c.last().getByRole('link', { name: /Mock headline about TSLA/ });
    await link.waitFor();
    assert((await link.getAttribute('href')) === 'https://example.com/news/1', 'bad link');
    await c.last().getByText('Mock Newswire').waitFor();
  });

  await step(`${label}: Gemini-proposed trade still requires the user's confirmation`, async () => {
    await c.ask('Buy $500 of Tesla');
    await c.last().getByText('Confirm virtual purchase').waitFor();
    await c.last().getByText(/MOCK-FINAL after propose_trade/).waitFor();
    await page.goto(base + '/activity');
    assert((await page.getByText('Bought TSLA').count()) === 0, 'trade executed without confirmation');
    await page.goto(base + '/ai');
    await c.last().getByText('Confirm virtual purchase').waitFor();
    await c.bottom();
    await c.last().getByRole('button', { name: 'Confirm' }).click();
    await c.last().getByText(/Bought .* TSLA for \$500\.00/).waitFor();
  });

  await step(`${label}: Gemini 429 → clear notice and built-in analyst fallback`, async () => {
    await c.ask('Compare Tesla and NVIDIA QUOTA');
    await c.last().getByText(/Gemini free quota is used up/).waitFor();
    await c.last().getByText('~37s', { exact: false }).waitFor();
    await c.last().getByRole('table').waitFor();
    await c.last().getByText('· Built-in analyst').waitFor();
    await c.ask('Analyze Apple OVERLOAD');
    await c.last().getByText(/AI service is unavailable right now/).waitFor();
    await c.last().getByText('Company report').waitFor();
  });

  await step(`${label}: conversation continues normally after a failure`, async () => {
    await c.ask('Analyze it again');
    await c.last().getByText(/MOCK-FINAL after analyze_company/).waitFor();
  });

  await step(`${label}: data-provider rate limit and unknown ticker are reported, not hidden`, async () => {
    const r = await fetch(base + '/api/market?op=history&symbol=RATE&range=1M');
    const j = await r.json();
    assert(r.status === 429 && j.error.code === 'provider_rate_limited' && r.headers.get('retry-after') === '60', JSON.stringify(j));
    const q = await (await fetch(base + '/api/market?op=quote&symbols=ZZZZ')).json();
    assert(q.quotes.length === 0 && q.missing[0] === 'ZZZZ', JSON.stringify(q));
    const bad = await fetch(base + '/api/market?op=quote&symbols=<script>');
    assert(bad.status === 400, 'bad symbol accepted');
  });

  await step(`${label}: /api/ai validates input and rate-limits per client`, async () => {
    const post = (body) => fetch(base + '/api/ai', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    assert((await post({ contents: [{ role: 'model', parts: [{ text: 'x' }] }] })).status === 400, 'must start with user');
    assert((await post({ contents: [{ role: 'user', parts: [{ text: 'hi' }] }, { role: 'model', parts: [{ functionCall: { name: 'delete_everything', args: {} } }] }] })).status === 400, 'unknown tool accepted');
    assert((await fetch(base + '/api/ai')).status === 405, 'GET allowed');
    let limited = 0;
    for (let i = 0; i < 45; i++) if ((await post({ contents: [{ role: 'user', parts: [{ text: 'hello' }] }] })).status === 429) limited++;
    assert(limited > 0, 'no rate limit hit');
  });

  await step(`${label}: API keys never reach the browser`, async () => {
    const all = bodies.join('\n') + (await page.content());
    for (const k of Object.values(MOCK_KEYS)) assert(!all.includes(k), `key ${k} leaked to the client`);
    assert(bodies.length > 5, 'no responses captured');
  });

  await page.context().close();
  stop();
  mocks.close();
}

await browser.close();
for (const r of results) console.log(r.join('  '));
if (errors.length) console.log('\nBrowser errors:\n' + [...new Set(errors)].join('\n'));
const failed = results.filter((r) => r[0] === 'FAIL').length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed || errors.length ? 1 : 0);
