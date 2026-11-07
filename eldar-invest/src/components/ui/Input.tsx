import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/cn';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | null;
  hint?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, FieldProps>(function Input(
  { label, error, hint, leading, trailing, className, id, type, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [reveal, setReveal] = useState(false);
  const isPassword = type === 'password';
  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="label mb-1.5 block">
          {label}
        </label>
      )}
      <div
        className={cn(
          'flex h-12 items-center gap-2 rounded-xl border bg-surface px-3.5 transition-[border-color,box-shadow] focus-within:border-brand focus-within:shadow-[0_0_0_4px_rgb(var(--brand)/0.12)]',
          error ? 'border-loss' : 'border-line',
        )}
      >
        {leading && <span className="text-ink-3">{leading}</span>}
        <input
          ref={ref}
          id={inputId}
          type={isPassword && reveal ? 'text' : type}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? inputId + '-err' : hint ? inputId + '-hint' : undefined}
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            className="rounded-lg p-1 text-ink-3 hover:text-ink"
            aria-label={reveal ? 'Hide password' : 'Show password'}
          >
            {reveal ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
        {trailing}
      </div>
      {error ? (
        <p id={inputId + '-err'} className="mt-1.5 text-[13px] text-loss" role="alert">
          {error}
        </p>
      ) : hint ? (
        <div id={inputId + '-hint'} className="mt-1.5 text-[13px] text-ink-3">
          {hint}
        </div>
      ) : null}
    </div>
  );
});
