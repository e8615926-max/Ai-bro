import { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[ELDAR INVEST]', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const chunk = /dynamically imported module|Loading chunk/i.test(this.state.error.message);
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-loss-soft text-loss">
          <AlertTriangle />
        </div>
        <h1 className="text-xl font-semibold">{chunk ? 'A new version is available' : 'Something went wrong'}</h1>
        <p className="mt-2 max-w-sm text-sm text-ink-2">
          {chunk ? 'Reload the page to continue.' : 'An unexpected error occurred. Your virtual portfolio is safe — reloading usually fixes this.'}
        </p>
        <div className="mt-6 flex gap-3">
          <button className="h-11 rounded-xl bg-brand px-5 text-sm font-semibold text-brand-ink" onClick={() => window.location.reload()}>
            Reload
          </button>
          <button
            className="h-11 rounded-xl bg-surface-2 px-5 text-sm font-semibold"
            onClick={() => {
              this.setState({ error: null });
              if (window.location.origin === 'null' || window.location.protocol === 'about:') window.location.reload();
              else window.location.assign(window.location.hash ? '#/' : '/');
            }}
          >
            Go home
          </button>
        </div>
      </div>
    );
  }
}
