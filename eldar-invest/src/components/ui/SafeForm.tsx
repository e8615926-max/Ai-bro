import type { KeyboardEvent, ReactNode } from 'react';

/**
 * A <form> that never depends on native submission. Some embedded previews
 * sandbox the page without `allow-forms`, which silently blocks submit
 * events — so Enter and the submit button call `onSubmit` directly.
 * Pair it with <Button type="button" onClick={submit}> for the primary action.
 */
export function SafeForm({ onSubmit, children, className }: { onSubmit: () => void; children: ReactNode; className?: string }) {
  const onKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    const t = e.target as HTMLInputElement;
    if (e.key === 'Enter' && t.tagName === 'INPUT' && t.type !== 'checkbox' && t.type !== 'radio') {
      e.preventDefault();
      onSubmit();
    }
  };
  return (
    <form
      className={className}
      noValidate
      onKeyDown={onKeyDown}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {children}
    </form>
  );
}
