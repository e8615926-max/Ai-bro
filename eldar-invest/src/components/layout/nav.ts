import { Briefcase, Compass, History, LayoutGrid, Sparkles, Star, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  /** Highlighted entry (ELDAR AI). */
  accent?: boolean;
  /** Hidden from the phone tab bar (still in the sidebar and account menu). */
  desktopOnly?: boolean;
}

export const NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: LayoutGrid, end: true },
  { to: '/markets', label: 'Markets', icon: Compass },
  { to: '/ai', label: 'ELDAR AI', icon: Sparkles, accent: true },
  { to: '/portfolio', label: 'Portfolio', icon: Briefcase },
  { to: '/watchlist', label: 'Watchlist', icon: Star },
  { to: '/activity', label: 'Activity', icon: History, desktopOnly: true },
];
