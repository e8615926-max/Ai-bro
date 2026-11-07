import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useToasts } from '@/stores/toast';

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-3 sm:bottom-6 sm:left-auto sm:right-6 sm:top-auto sm:items-end" aria-live="polite" role="region" aria-label="Notifications">
      {toasts.map((t) => {
        const Icon = t.tone === 'success' ? CheckCircle2 : t.tone === 'error' ? AlertCircle : Info;
        return (
          <div key={t.id} className="pointer-events-auto flex w-full max-w-sm animate-rise items-start gap-3 rounded-2xl border border-line bg-surface p-3.5 shadow-pop">
            <Icon size={20} className={cn('mt-px shrink-0', t.tone === 'success' ? 'text-gain' : t.tone === 'error' ? 'text-loss' : 'text-brand')} />
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-semibold">{t.title}</div>
              {t.description && <div className="mt-0.5 text-[12.5px] text-ink-2">{t.description}</div>}
              {t.action && (
                <Link to={t.action.href} onClick={() => dismiss(t.id)} className="mt-1.5 inline-block text-[12.5px] font-semibold text-brand">
                  {t.action.label}
                </Link>
              )}
            </div>
            <button onClick={() => dismiss(t.id)} className="rounded-md p-0.5 text-ink-3 hover:text-ink" aria-label="Dismiss">
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
