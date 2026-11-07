export type ThemePreference = 'light' | 'dark' | 'system';

export interface Holding {
  symbol: string;
  shares: number;
  /** Total cost basis of the open position (average-cost method). */
  costBasis: number;
  openedAt: number;
}

export type TransactionType = 'buy' | 'sell' | 'deposit';

export interface Transaction {
  id: string;
  type: TransactionType;
  symbol?: string;
  shares?: number;
  price?: number;
  /** Cash amount moved (always positive). */
  amount: number;
  /** Realised profit/loss for sells. */
  realizedPnl?: number;
  cashAfter: number;
  at: number;
  /** True for trades created by the optional sample portfolio. */
  sample?: boolean;
}

export type ActivityKind =
  | 'register'
  | 'login'
  | 'logout'
  | 'trade'
  | 'watchlist'
  | 'settings'
  | 'profile'
  | 'security'
  | 'reset';

export interface ActivityEntry {
  id: string;
  kind: ActivityKind;
  message: string;
  at: number;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  at: number;
  read: boolean;
  tone: 'success' | 'info' | 'warning';
  href?: string;
}

export interface NotificationPrefs {
  tradeConfirmations: boolean;
  priceAlerts: boolean;
  /** Fractional move (e.g. 0.02 = 2%) since previous close that triggers an alert. */
  priceAlertThreshold: number;
  dailySummary: boolean;
}

export interface UserSettings {
  theme: ThemePreference;
  hideBalances: boolean;
  defaultRange: '1D' | '1W' | '1M' | '3M' | '1Y' | '5Y';
  notifications: NotificationPrefs;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  createdAt: number;
  avatarHue: number;
}

export interface UserData {
  version: 1;
  profile: UserProfile;
  account: {
    startingBalance: number;
    cash: number;
    /** Start of the current virtual portfolio (account creation or last reset). */
    startedAt: number;
  };
  holdings: Record<string, Holding>;
  transactions: Transaction[];
  watchlist: string[];
  settings: UserSettings;
  activity: ActivityEntry[];
  notifications: AppNotification[];
  /** Day number of the last time price alerts fired per symbol. */
  alertLog: Record<string, number>;
  updatedAt: number;
}
