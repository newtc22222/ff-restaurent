import {
  BarChart2,
  LayoutDashboard,
  Store,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  isRouteErrorResponse,
  NavLink,
  Outlet,
  useLoaderData,
  useNavigate,
  useRouteError,
} from 'react-router';
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    typeof window === 'undefined'
      ? false
      : window.matchMedia('(max-width: 767px)').matches,
  );

  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const syncSidebar = () => setSidebarCollapsed(query.matches);
    query.addEventListener('change', syncSidebar);
    return () => query.removeEventListener('change', syncSidebar);
  }, []);

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
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed((current) => !current)}
      />
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <Sidebar
          nav={nav}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((current) => !current)}
          onNavigate={() => {
            if (window.matchMedia('(max-width: 767px)').matches) {
              setSidebarCollapsed(true);
            }
          }}
        />
        <main className="min-h-0 flex-1 overflow-hidden py-3">
          <ScrollArea className="h-full">
            <div className="px-3 pb-3 sm:px-4 md:px-6 md:pb-6">
              <div className="mx-auto w-full max-w-[1500px]">
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

export function RouteHydrateFallback() {
  const { t } = useI18n();

  return (
    <div
      className="grid h-screen place-items-center bg-bg px-4 text-center text-ink"
      role="status"
    >
      <p className="text-sm font-medium text-slate-500">
        {t('common.loading')}
      </p>
    </div>
  );
}

export function RouteErrorBoundary() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText || 'Request failed'}`
    : error instanceof Error
      ? error.message
      : 'The requested page could not be loaded.';

  return (
    <div className="grid h-screen place-items-center bg-bg px-4 text-center text-ink">
      <div>
        <h1 className="text-xl font-bold">Something went wrong</h1>
        <p className="mt-2 max-w-md text-sm text-slate-500">{message}</p>
        <NavLink className="btn btn-primary mt-5" to="/bills">
          Back to bills
        </NavLink>
      </div>
    </div>
  );
}
