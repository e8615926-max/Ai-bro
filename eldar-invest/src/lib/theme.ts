import type { ThemePreference } from '@/domain/types';
import { readRaw, writeRaw } from '@/services/storage';

export function resolveTheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref === 'system') return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  return pref;
}

export function storedTheme(): ThemePreference {
  const raw = readRaw('theme');
  return raw === 'dark' || raw === 'system' || raw === 'light' ? raw : 'light';
}

export function applyTheme(pref: ThemePreference, animate = false) {
  writeRaw('theme', pref);
  const root = document.documentElement;
  const next = resolveTheme(pref);
  if (root.getAttribute('data-theme') === next) return;
  if (animate) {
    root.classList.add('theme-transition');
    window.setTimeout(() => root.classList.remove('theme-transition'), 300);
  }
  root.setAttribute('data-theme', next);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', next === 'dark' ? '#0a0d0c' : '#ffffff'));
}
