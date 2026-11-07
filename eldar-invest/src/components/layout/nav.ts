import { Briefcase, Compass, History, LayoutGrid, Star, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

export const NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: LayoutGrid, end: true },
  { to: '/markets', label: 'Markets', icon: Compass },
  { to: '/portfolio', label: 'Portfolio', icon: Briefcase },
  { to: '/watchlist', label: 'Watchlist', icon: Star },
  { to: '/activity', label: 'Activity', icon: History },
];
