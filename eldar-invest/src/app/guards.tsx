import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { FullScreenLoader } from '@/components/ui/Spinner';
import { useAccount } from '@/stores/account';
import { useSession } from '@/stores/session';
import { Button } from '@/components/ui/Button';

export function RequireAuth() {
  const status = useSession((s) => s.status);
  const account = useAccount((s) => s.status);
  const error = useAccount((s) => s.error);
  const user = useSession((s) => s.user);
  const load = useAccount((s) => s.load);
  const loc = useLocation();
  if (status === 'loading') return <FullScreenLoader label="Securing your session" />;
  if (status === 'guest') return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (account === 'error')
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-lg font-semibold">We couldn't load your account</h1>
        <p className="max-w-sm text-sm text-ink-2">{error}</p>
        <Button onClick={() => user && load(user).catch(() => {})}>Try again</Button>
      </div>
    );
  if (account !== 'ready') return <FullScreenLoader label="Loading your portfolio" />;
  return <Outlet />;
}

export function GuestOnly() {
  const status = useSession((s) => s.status);
  const loc = useLocation();
  if (status === 'loading') return <FullScreenLoader />;
  if (status === 'authenticated') {
    const from = (loc.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== '/login' ? from : '/'} replace />;
  }
  return <Outlet />;
}
