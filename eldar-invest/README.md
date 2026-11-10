# ELDAR INVEST — by ELDAR COMPANY

ELDAR INVEST is a premium investing simulator. You can practise investing in stocks and ETFs with
**virtual money** and **simulated market data**. It is a complete app: accounts, a virtual balance,
simulated buy and sell orders, a live-updating portfolio, a watchlist, history, notifications,
light and dark themes, and data that persists.

> **Demo data notice.** Company names and tickers identify assets only. Every price, chart,
> volume and statistic is produced by the built-in simulator (`src/lib/market.ts`). None of it
> is a real market quote, and nothing here is investment advice. The UI labels simulated
> figures throughout ("Demo data", "Simulated").

## Quick start

```bash
cd eldar-invest
npm install
npm run dev        # http://localhost:5173
```

| Script              | What it does                                            |
| ------------------- | ------------------------------------------------------- |
| `npm run dev`       | Vite dev server                                         |
| `npm run build`     | Type-check and production build to `dist/`              |
| `npm run preview`   | Serve the production build                              |
| `npm test`          | Unit tests (trading engine and market simulator)        |
| `npm run e2e`       | Browser smoke test of all major flows (needs a build)   |
| `npm run e2e:ai`    | Browser tests for ELDAR AI (needs a build)              |

## Features

- **Home dashboard**: portfolio value with an interactive performance chart (1D–5Y), daily gain
  and loss, total return, invested and cash KPIs, popular stocks, favourites and recent transactions.
- **Markets**: 34 stocks and ETFs, search by name or ticker, category filters, sorting,
  top gainers and losers, and 24h sparklines.
- **Asset pages**: live simulated price, interactive chart with crosshair, tooltip and keyboard
  control, key statistics, day and 52-week ranges, your position, your history and related assets.
- **Trading**: buy or sell by dollar amount or by number of shares, fractional shares, quick
  amounts, a review step, validation (funds, holdings, minimums) and order confirmation.
- **Portfolio**: holdings with shares, average cost, value, day change and P&L; realised and
  unrealised P&L; an allocation chart.
- **Watchlist**: add and remove assets, track moves, follow suggestions.
- **Activity**: transaction history grouped by day with filters and CSV export, plus an
  account activity log.
- **Profile and settings**: name and avatar, password change, portfolio reset, account deletion,
  light/dark/system theme, hidden balances, default chart range, notification preferences
  (order confirmations, price-move alerts with a threshold, daily summary) and JSON data export.
- **Everywhere**: a responsive, mobile-first layout (bottom navigation on phones, sidebar on
  desktop), loading skeletons, an error boundary, toasts, `/` or `⌘K` search, and accessible
  dialogs.

## ELDAR AI — the built-in financial analyst

The **ELDAR AI** tab is a chat-based analyst with a dedicated **Stock Picks** section. It answers
in Russian or English and replies with interactive cards, not just text:

| Ask | You get |
| --- | --- |
| "Analyze NVIDIA" | Company report: profile, price picture, key metrics, latest annual results, earnings, news, 6-month chart |
| "What could happen to Tesla tomorrow?" | Scenario forecast: current price and timestamp, estimated range, bullish / neutral / bearish ranges, reasons, risks, model confidence, data quality |
| "Compare Tesla and NVIDIA" | Performance chart (1D–5Y) plus a side-by-side metrics table |
| "Show me 5 stocks worth researching" | Research candidates ranked by a transparent factor score, with reasons and risks |
| "Analyze my portfolio" | Allocation, sector mix, risk allocation, strengths, weak spots, diversification ideas |
| "Buy $500 of Tesla" / "Sell half of my NVIDIA shares" | A confirmation card. Nothing is traded until you press **Confirm** |
| "What if Tesla dropped by 10%?" | What-if simulation on your real virtual holdings |
| "Why is Tesla falling today?" | News with headline, source, date and link (only when a news provider is connected) |

Follow-ups keep context: "What about tomorrow?", "Compare it with Microsoft".

### Two engines, one set of tools

- **Gemini mode** (server has `GEMINI_API_KEY`): Gemini understands free-form questions and decides
  which tools to call; the app runs the tools and Gemini writes the interpretation.
- **Built-in analyst** (no key, the standalone HTML file, or when Gemini is rate-limited): a local
  RU/EN intent parser calls the same tools and writes templated summaries. Nothing breaks when the
  AI quota runs out — the chat says so and keeps answering.

Every number comes from a tool, never from the language model: forecasts are computed from
historical volatility (`src/ai/analytics.ts`), picks from a documented factor score, and portfolio
figures from the app's own data. The model is instructed, server-side, to never invent prices,
news, metrics or sources, and tool results explicitly say "unavailable" when data is missing.

### Two data modes, always labelled

- **Demo data** (default): prices come from the ELDAR INVEST simulator. Cards carry a "Demo data"
  badge; news, events and financial statements are reported as unavailable rather than invented.
- **Real data** (server has provider keys): every card shows its source and timestamp.

The virtual portfolio and all virtual trades always use ELDAR INVEST's simulated exchange prices,
so research cards (real prices) and the trading price (simulated) can differ. The confirmation card
states which price is used.

### Server API (keys never reach the browser)

```
api/ai.ts      POST  Gemini proxy: adds the system rules and tool list server-side, validates input
api/market.ts  GET   quotes, history, profile, metrics, filings, news, events, screen
api/status.ts  GET   which capabilities are configured (no secrets)
server/        shared handlers, provider adapters, caching and rate limiting
```

The same handlers run as Vercel functions and inside `npm run dev` / `npm run preview`.
To run locally with real services, copy `.env.example` to `.env.local` and fill in the server keys.

### Providers and their limits (checked November 2026 — verify before launch)

| Provider | Used for | Free tier | Licence note |
| --- | --- | --- | --- |
| Google Gemini (AI Studio) | Language model | Free quota per model, shown in AI Studio; changes over time, **not unlimited** | Free-tier prompts may be used by Google to improve products. Apps offered to users in the EEA, UK or Switzerland must use the paid tier |
| Finnhub | Quotes, profiles and logos, metrics, earnings, news | About 60 calls/minute | Free plan is for **personal use**; a public or commercial app needs a paid plan. Historical candles are a paid endpoint (not used) |
| Twelve Data | Price history | 8 requests/minute, 800/day | Free plan is **personal, internal, non-display**; showing data to other users needs a Business plan |
| SEC EDGAR | Annual report figures (US filers) | Free, no key, max 10 requests/second | Public U.S. government data. Requires a User-Agent with contact details. No ETFs or foreign (20-F) filers |

So the free tiers are fine for building and personal testing; a public launch needs paid data
licences. Adapters live in `server/providers/` behind provider-neutral types
(`server/providers/types.ts`), so a vendor can be swapped without touching the app.

Server-side protections: response caching per data type, per-visitor rate limits on `/api/ai`
(in-memory, best effort on serverless), request-size and shape validation, tool-name allow-list.
Provider quotas remain the hard limit; when one is hit the UI shows a "try again in N seconds"
notice instead of failing silently.

Conversation history is stored per user in the browser (not in Firestore).

### Tests

- `npm test`: 68 unit tests (trading engine, simulator, indicators, forecast maths, screening,
  RU/EN intent parsing, provider adapters with mocked responses, EDGAR parsing).
- `npm run e2e:ai`: browser tests on phone and desktop for the built-in analyst, plus a second
  phase where Gemini and the data providers are replaced by local mocks
  (`scripts/mock-upstreams.mjs`) to exercise tool calling, real-data cards, the confirmation flow,
  rate-limit fallback, input validation and key secrecy.

## Architecture

```
src/
  ai/             ELDAR AI: analytics, tools, intent parser, engine, providers, i18n
  app/            App root, router, route guards, error boundary
  components/     Reusable UI: brand (logo), ui (Button, Input, Modal…), charts,
                  layout (AppShell, nav), asset, trade, portfolio
  data/assets.ts  Demo asset catalogue
  domain/         Pure business logic: types, trading engine, valuation, history replay
  lib/            Market simulator, formatting, theme, deterministic RNG, time helpers
  pages/          Route screens (lazy-loaded)
  services/       Backend adapters behind interfaces
    auth/         AuthService: LocalAuthService | FirebaseAuthService
    data/         UserRepository: LocalUserRepository | FirestoreUserRepository
  stores/         Zustand stores: session, account, market clock, UI, toasts
```

- **Pure domain layer.** `domain/account.ts` has no UI or storage dependencies. It runs the trades
  (average-cost basis, realised P&L, cash checks), values the portfolio and rebuilds historical
  value by replaying transactions. Unit tests cover it.
- **Deterministic market simulator.** A price depends only on `(symbol, time)`. Daily closes come
  from a seeded log-normal walk, and intraday moves from a seeded Brownian bridge between closes.
  Prices "move" in real time, but they stay the same across reloads and devices, so portfolio
  values and charts stay consistent.
- **Swappable backends.** UI code only talks to `authService` and `userRepository` (from
  `src/services/index.ts`).

## Firebase integration

The app is ready for Firebase Authentication and Cloud Firestore.

1. Create a Firebase project. Enable **Email/Password** sign-in and **Cloud Firestore**.
2. Copy `.env.example` to `.env.local` and fill in all `VITE_FIREBASE_*` values.
3. Deploy the security rules: `firebase deploy --only firestore:rules` (see `firestore.rules`:
   each user can only access `users/{their uid}`).
4. Restart the dev server. The app switches to Firebase automatically, and the Settings page
   shows "Cloud".

The Firebase SDK is code-split and only downloaded when Firebase is configured.

## Security notes

- **Local backend (default demo):** accounts are stored in the browser. Passwords are hashed
  with PBKDF2-SHA-256 (150k iterations, random per-user salt) and compared in constant time.
  Sessions are random tokens with an expiry ("keep me signed in" controls local or session
  storage). Repeated failed sign-ins are throttled. This suits an offline demo but is not a
  substitute for server-side auth.
- **Production:** use the Firebase backend. Authentication then runs on Google's servers,
  sensitive actions (password change, deletion) re-authenticate, and Firestore rules isolate
  each user's data.

## Deployment

`npm run build` produces a static `dist/` folder. SPA fallbacks are included for Vercel
(`vercel.json`), Netlify (`public/_redirects`) and Firebase Hosting (`firebase.json`).
