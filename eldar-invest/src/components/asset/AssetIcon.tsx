import { getAsset } from '@/data/assets';
import { cn } from '@/lib/cn';

/** Neutral monogram (we don't use third-party logos). */
export function AssetIcon({ symbol, size = 40, className }: { symbol: string; size?: number; className?: string }) {
  const a = getAsset(symbol);
  const hue = a?.hue ?? 150;
  const label = symbol.slice(0, 4);
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center rounded-[30%] font-bold tracking-tight', className)}
      style={{
        width: size,
        height: size,
        fontSize: size * (label.length <= 2 ? 0.36 : label.length === 3 ? 0.29 : 0.245),
        color: `hsl(${hue} 60% var(--icon-l, 38%))`,
        background: `hsl(${hue} 70% var(--icon-bg, 95%))`,
      }}
      aria-hidden="true"
    >
      {label}
    </span>
  );
}
