import { useId } from 'react';
import { cn } from '@/lib/cn';

/**
 * ELDAR COMPANY mark: an "E" whose three arms rise in length like an
 * ascending bar chart — growth, structure and clarity in one glyph.
 */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`lg-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#19c37d" />
          <stop offset="1" stopColor="#0b7a4b" />
        </linearGradient>
        <linearGradient id={`hl-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".22" />
          <stop offset=".5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill={`url(#lg-${id})`} />
      <rect width="40" height="40" rx="11" fill={`url(#hl-${id})`} />
      <g fill="#fff">
        <rect x="11" y="10" width="5" height="20" rx="1.6" />
        <rect x="11" y="10" width="18" height="4.6" rx="1.6" />
        <rect x="11" y="17.7" width="14.5" height="4.6" rx="1.6" opacity=".9" />
        <rect x="11" y="25.4" width="11" height="4.6" rx="1.6" opacity=".8" />
      </g>
    </svg>
  );
}

export function Logo({ className, compact = false, product = true }: { className?: string; compact?: boolean; product?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)} aria-label={product ? 'ELDAR INVEST' : 'ELDAR COMPANY'}>
      <LogoMark size={compact ? 28 : 32} />
      <span className="flex flex-col leading-none">
        <span className="text-[15px] font-bold tracking-[0.14em] text-ink">ELDAR</span>
        <span className="mt-[3px] text-[9.5px] font-semibold tracking-[0.32em] text-brand">{product ? 'INVEST' : 'COMPANY'}</span>
      </span>
    </span>
  );
}
