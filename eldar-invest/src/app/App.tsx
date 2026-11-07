import { lazy, useEffect } from 'react';
import { createBrowserRouter, Outlet, RouterProvider } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Toaster } from '@/components/ui/Toaster';
import { useMarket } from '@/stores/market';
import { useSession } from '@/stores/session';
import { ErrorBoundary } from './ErrorBoundary';
import { GuestOnly, RequireAuth } from './guards';
import { applyTheme, storedTheme } from '@/lib/theme';
import { useAccount } from '@/stores/account';
import { AuthLayout } from '@/pages/auth/AuthLayout';

const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Markets = lazy(() => import('@/pages/Markets'));
const AssetDetail = lazy(() => import('@/pages/AssetDetail'));
const Portfolio = lazy(() => import('@/pages/Portfolio'));
const Watchlist = lazy(() => import('@/pages/Watchlist'));
const Activity = lazy(() => import('@/pages/Activity'));
const Notifications = lazy(() => import('@/pages/Notifications'));
const Profile = lazy(() => import('@/pages/Profile'));
const Settings = lazy(() => import('@/pages/Settings'));
const NotFound = lazy(() => import('@/pages/NotFound'));
const Login = lazy(() => import('@/pages/auth/Login'));
const Register = lazy(() => import('@/pages/auth/Register'));

function Root() {
  return (
    <ErrorBoundary>
      <Outlet />
      <Toaster />
    </ErrorBoundary>
  );
}

const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
  {
    element: <GuestOnly />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: '/login', element: <Login /> },
          { path: '/register', element: <Register /> },
        ],
      },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/', element: <Dashboard /> },
          { path: '/markets', element: <Markets /> },
          { path: '/markets/:symbol', element: <AssetDetail /> },
          { path: '/portfolio', element: <Portfolio /> },
          { path: '/watchlist', element: <Watchlist /> },
          { path: '/activity', element: <Activity /> },
          { path: '/notifications', element: <Notifications /> },
          { path: '/profile', element: <Profile /> },
          { path: '/settings', element: <Settings /> },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
    ],
  },
]);

export function App() {
  const init = useSession((s) => s.init);
  const start = useMarket((s) => s.start);
  const theme = useAccount((s) => s.data?.settings.theme);

  useEffect(() => {
    void init();
    return start();
  }, [init, start]);

  // Follow OS changes when the "system" theme is selected.
  useEffect(() => {
    const pref = theme ?? storedTheme();
    if (pref !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => applyTheme('system', true);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [theme]);

  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}
