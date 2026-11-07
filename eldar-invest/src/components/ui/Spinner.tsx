import { cn } from '@/lib/cn';

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn('animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function FullScreenLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-bg" role="status" aria-live="polite">
      <div className="relative">
        <div className="absolute inset-0 animate-ping rounded-2xl bg-brand/20" />
        <svg width="48" height="48" viewBox="0 0 40 40" className="relative">
          <rect width="40" height="40" rx="11" fill="rgb(var(--brand))" />
          <g fill="#fff">
            <rect x="11" y="10" width="5" height="20" rx="1.6" />
            <rect x="11" y="10" width="18" height="4.6" rx="1.6" />
            <rect x="11" y="17.7" width="14.5" height="4.6" rx="1.6" opacity=".9" />
            <rect x="11" y="25.4" width="11" height="4.6" rx="1.6" opacity=".8" />
          </g>
        </svg>
      </div>
      <span className="text-sm text-ink-3">{label}…</span>
    </div>
  );
}
