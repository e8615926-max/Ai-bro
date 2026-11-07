/**
 * End-to-end smoke test for ELDAR INVEST.
 * Usage: npm run build && npm run e2e   (uses `vite preview` on port 4173)
 * Optional: SHOTS=dir to save screenshots.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

// Uses a globally installed Playwright (require resolves NODE_PATH; ESM import does not).
const { chromium } = createRequire(import.meta.url)('playwright');

const PORT = 4173;
const BASE = `http://localhost:${PORT}`;
const SHOTS = process.env.SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe', detached: true });
const stopServer = () => {
  try {
    process.kill(-server.pid);
  } catch {
    /* already stopped */
  }
};
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('preview server did not start')), 20000);
  server.stdout.on('data', (d) => d.toString().includes('localhost') && (clearTimeout(t), resolve()));
});

const errors = [];
const results = [];
const step = async (name, fn) => {
  try {
    await fn();
    results.push(['PASS', name]);
  } catch (e) {
    results.push(['FAIL', name, e.message.split('\n')[0]]);
  }
};

const browser = await chromium.launch();
async function run(viewport, label) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: SHOTS ? 2 : 1 });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', (e) => errors.push(`[${label}] pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`[${label}] console: ${m.text()}`));
  const shot = async (n) => SHOTS && page.screenshot({ path: `${SHOTS}/${label}-${n}.png`, fullPage: n !== 'trade' });
  const email = `user${Date.now()}${label}@example.com`;

  await step(`${label}: unauthenticated redirect to login`, async () => {
    await page.goto(BASE + '/portfolio');
    await page.waitForURL('**/login');
    await page.getByRole('heading', { name: 'Welcome back' }).waitFor();
    await shot('login');
  });

  await step(`${label}: register validation`, async () => {
    await page.getByRole('link', { name: 'Create a free account' }).click();
    await page.getByRole('button', { name: 'Create account' }).click();
    await page.getByText('Enter your name.').waitFor();
  });

  await step(`${label}: register`, async () => {
    await page.getByLabel('Full name').fill('Alex Morgan');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('Secure123!');
    await page.getByText('I understand ELDAR INVEST').click();
    await page.getByRole('button', { name: 'Create account' }).click();
    await page.getByRole('heading', { name: 'Alex' }).waitFor({ timeout: 10000 });
    await page.getByText('Total portfolio value').waitFor();
    await page.waitForTimeout(1200);
    await shot('dashboard');
  });

  await step(`${label}: markets search & filter`, async () => {
    await page.goto(BASE + '/markets');
    await page.getByLabel('Search by company name or ticker').fill('nvid');
    await page.getByRole('link', { name: 'NVIDIA (NVDA)' }).waitFor();
    await page.getByLabel('Search by company name or ticker').fill('');
    await page.getByRole('tab', { name: 'ETFs' }).click();
    await page.getByRole('link', { name: /SPDR S&P 500 ETF/ }).waitFor();
    await shot('markets');
  });

  await step(`${label}: asset page + chart ranges`, async () => {
    await page.goto(BASE + '/markets/AAPL');
    await page.getByRole('heading', { name: 'Apple', exact: true }).waitFor();
    for (const r of ['1W', '1M', '3M', '1Y', '5Y', '1D']) await page.getByRole('radio', { name: r, exact: true }).first().click();
    await page.waitForTimeout(1100);
    await shot('asset');
  });

  await step(`${label}: buy AAPL $2,500`, async () => {
    await page.getByRole('button', { name: /^Buy( AAPL)?$/ }).first().click();
    const dlg = page.getByRole('dialog');
    await dlg.getByLabel('Amount in US dollars').fill('2500');
    await shot('trade');
    await dlg.getByRole('button', { name: 'Review order' }).click();
    await dlg.getByRole('button', { name: 'Confirm purchase' }).click();
    await dlg.getByText('Order filled').waitFor({ timeout: 5000 });
    await dlg.getByRole('button', { name: 'Done' }).click();
  });

  await step(`${label}: insufficient funds blocked`, async () => {
    await page.getByRole('button', { name: /^Buy( AAPL)?$/ }).first().click();
    const dlg = page.getByRole('dialog');
    await dlg.getByLabel('Amount in US dollars').fill('999999');
    await dlg.getByText(/Not enough virtual cash/).waitFor();
    if (await dlg.getByRole('button', { name: 'Review order' }).isEnabled()) throw new Error('review enabled');
    await page.keyboard.press('Escape');
  });

  await step(`${label}: sell half`, async () => {
    await page.getByRole('button', { name: 'Sell', exact: true }).first().click();
    const dlg = page.getByRole('dialog');
    await dlg.getByRole('button', { name: '50%' }).click();
    await dlg.getByRole('button', { name: 'Review order' }).click();
    await dlg.getByRole('button', { name: 'Confirm sale' }).click();
    await dlg.getByText('Order filled').waitFor({ timeout: 5000 });
    await dlg.getByRole('button', { name: 'View portfolio' }).click();
    await page.waitForURL('**/portfolio');
    await page.getByText('Holdings (').waitFor();
    await page.getByText('Allocation').first().waitFor();
    await page.waitForTimeout(1100);
    await shot('portfolio');
  });

  await step(`${label}: watchlist add/remove`, async () => {
    await page.goto(BASE + '/markets/MSFT');
    await page.getByRole('button', { name: 'Add to watchlist' }).click();
    await page.goto(BASE + '/watchlist');
    await page.getByRole('link', { name: 'Open Microsoft' }).waitFor();
    await shot('watchlist');
    await page.getByRole('button', { name: 'Remove MSFT from watchlist' }).click();
    await page.getByRole('link', { name: 'Open Microsoft' }).waitFor({ state: 'detached' });
  });

  await step(`${label}: activity lists trades`, async () => {
    await page.goto(BASE + '/activity');
    await page.getByText('Bought AAPL').first().waitFor();
    await page.getByText('Sold AAPL').first().waitFor();
    await page.getByRole('radio', { name: 'Account activity' }).click();
    await page.getByText('Account created').waitFor();
  });

  await step(`${label}: dark theme persists`, async () => {
    await page.goto(BASE + '/settings');
    await page.getByRole('radio', { name: 'Dark' }).click();
    await page.waitForTimeout(500);
    await page.reload();
    const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    if (theme !== 'dark') throw new Error('theme ' + theme);
    await page.goto(BASE + '/');
    await page.waitForTimeout(1200);
    await shot('dashboard-dark');
    await page.goto(BASE + '/settings');
    await page.getByRole('radio', { name: 'Light' }).click();
  });

  await step(`${label}: notifications page`, async () => {
    await page.goto(BASE + '/notifications');
    await page.getByText('Order filled · AAPL').first().waitFor();
    await page.getByRole('button', { name: 'Mark all read' }).click();
  });

  await step(`${label}: profile & data persist after sign-out/in`, async () => {
    await page.goto(BASE + '/profile');
    await page.getByRole('heading', { name: 'Alex Morgan' }).waitFor();
    await shot('profile');
    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await page.waitForURL('**/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('wrongpass1');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByText('Incorrect email or password.').waitFor();
    await page.getByLabel('Password', { exact: true }).fill('Secure123!');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.getByText('Total portfolio value').waitFor();
    await page.goto(BASE + '/portfolio');
    await page.getByRole('link', { name: /AAPL/ }).first().waitFor();
  });

  await step(`${label}: unknown asset & 404`, async () => {
    await page.goto(BASE + '/markets/ZZZZ');
    await page.getByText('Asset not found').waitFor();
    await page.goto(BASE + '/nope');
    await page.getByText('Page not found').waitFor();
  });

  await step(`${label}: search dialog keyboard`, async () => {
    await page.goto(BASE + '/');
    await page.getByText('Total portfolio value').waitFor();
    await page.keyboard.press('/');
    await page.getByRole('combobox').fill('tesla');
    await page.keyboard.press('Enter');
    await page.waitForURL('**/markets/TSLA');
  });

  await step(`${label}: no horizontal overflow`, async () => {
    for (const p of ['/', '/markets', '/portfolio', '/watchlist', '/activity', '/settings', '/profile', '/markets/NVDA']) {
      await page.goto(BASE + p);
      await page.waitForTimeout(400);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (over > 1) throw new Error(`${p} overflows by ${over}px`);
    }
  });

  await ctx.close();
}

try {
  await run({ width: 1440, height: 960 }, 'desktop');
  await run({ width: 390, height: 844 }, 'mobile');
} finally {
  await browser.close();
  stopServer();
}

for (const r of results) console.log(r.join('  '));
if (errors.length) console.log('\nBrowser errors:\n' + [...new Set(errors)].join('\n'));
const failed = results.filter((r) => r[0] === 'FAIL').length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed || errors.length ? 1 : 0);
