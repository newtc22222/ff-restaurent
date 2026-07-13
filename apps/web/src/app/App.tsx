import {
  BarChart2,
  LayoutDashboard,
  Store,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { NavLink, Outlet, useLoaderData, useNavigate } from 'react-router';
import type { Notification } from '../lib/api';
import {
  AppProvider,
  type AppLoaderData,
  useAppContext,
} from './providers/app-context';
import { useI18n } from './providers/i18n';
import { isHead } from '../lib/helpers';
import { useMutation } from '../hooks/useMutation';
import AppHeader from '../components/layout/AppHeader';
import Sidebar from '../components/layout/Sidebar';
import ScrollArea from '../components/ui/ScrollArea';

function AppShellContent() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { user, notifications, warning, error, loading, setError } =
    useAppContext();
  const { mutate } = useMutation(setError);

  const openNotification = async (notification: Notification) => {
    if (!notification.readAt) {
      await mutate(
        { intent: 'read-notification', notificationId: notification.id },
        {
          action: '/bills',
          clearFirst: false,
          fallback: 'Could not read notification',
        },
      );
    }
    if (notification.billId) navigate(`/bills/${notification.billId}`);
  };

  const nav: readonly (readonly [string, LucideIcon, string])[] = [
    ['/bills', LayoutDashboard, t('nav.bills')],
    ['/restaurants', Store, t('nav.restaurants')],
    ['/stats', BarChart2, t('nav.stats')],
    ...(isHead(user)
      ? ([['/admin', Users, t('nav.members')]] as [
          string,
          LucideIcon,
          string,
        ][])
      : []),
  ];

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg font-sans text-ink">
      <AppHeader
        onProfile={() => navigate('/profile')}
        notifications={notifications}
        onOpenNotification={openNotification}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
        <Sidebar nav={nav} />
        <main className="min-h-0 flex-1 overflow-hidden py-3">
          <ScrollArea className="h-full" contentClassName="p-4 md:p-6">
            <div className="mx-auto max-w-5xl">
              {(warning || error) && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
                  {error ?? warning}
                </div>
              )}
              {loading && (
                <div className="mb-4 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-slate-500">
                  {t('common.loading')}
                </div>
              )}
              <Outlet />
            </div>
          </ScrollArea>
        </main>
      </div>
    </div>
  );
}

export function AuthenticatedRoot() {
  const data = useLoaderData<AppLoaderData>();
  return (
    <AppProvider data={data}>
      <Outlet />
    </AppProvider>
  );
}

export function App() {
  return <AppShellContent />;
}

export function RouteErrorBoundary() {
  return (
    <div className="grid h-screen place-items-center bg-bg px-4 text-center text-ink">
      <div>
        <h1 className="text-xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-sm text-slate-500">
          The requested page could not be loaded.
        </p>
        <NavLink className="btn btn-primary mt-5" to="/bills">
          Back to bills
        </NavLink>
      </div>
    </div>
  );
}
