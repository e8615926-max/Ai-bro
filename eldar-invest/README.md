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

## Architecture

```
src/
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
