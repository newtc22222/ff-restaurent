import {
  BarChart2,
  FolderHeart,
  LayoutDashboard,
  MapPinned,
  Store,
  UserRoundCheck,
  Users,
  Utensils,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  NavLink,
  Outlet,
  isRouteErrorResponse,
  useLoaderData,
  useLocation,
  useNavigate,
  useRouteError,
} from 'react-router';

import type { Notification } from '@/api/types';
import AppHeader from '@/components/layout/AppHeader';
import MobileNav from '@/components/layout/MobileNav';
import Sidebar from '@/components/layout/Sidebar';
import type { NavigationItem } from '@/components/layout/navigation';
import ScrollArea from '@/components/ui/ScrollArea';
import {
  notificationMessage,
  notificationTarget,
} from '@/features/notifications/notification-message';
import { usePushSubscription } from '@/features/notifications/push-subscription.queries';
import { useRouteMutation } from '@/hooks/useRouteMutation';
import { isRootAdmin } from '@/lib/permissions';

import {
  type AppLoaderData,
  AppProvider,
  useAppContext,
} from './providers/app-context';
import { useI18n } from './providers/i18n';

function AppShellContent() {
  const { locale, t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, notifications, warning, loading } = useAppContext();
  const { mutate } = useRouteMutation();
  const warned = useRef(false);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  usePushSubscription(locale);

  useEffect(() => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
    }
  }, [location.pathname]);

  useEffect(() => {
    if (warning && !warned.current) {
      warned.current = true;
      toast.error(t('toast.partialData'), { id: 'app-loader-warning' });
    }
    if (!warning) warned.current = false;
  }, [t, warning]);

  const localizedNotifications = notifications.map((notification) => ({
    ...notification,
    message: notificationMessage(notification, t),
  }));

  const openNotification = async (notification: Notification) => {
    if (!notification.readAt) {
      await mutate(
        { intent: 'read-notification', notificationId: notification.id },
        {
          action: '/bills',
          fallback: t('toast.notificationReadFailed'),
        },
      );
    }
    const target = notificationTarget(notification);
    if (target) navigate(target);
  };

  const markAllNotificationsRead = () =>
    mutate(
      { intent: 'read-all-notifications' },
      {
        action: '/bills',
        fallback: t('toast.notificationsReadFailed'),
        success: t('toast.notificationsRead'),
      },
    );

  const nav: readonly NavigationItem[] = [
    ['/bills', LayoutDashboard, t('nav.bills')],
    ['/restaurants', Store, t('nav.restaurants')],
    ['/cuisines', Utensils, t('nav.cuisines')],
    ['/dining-areas', MapPinned, t('nav.diningAreas')],
    ['/collections', FolderHeart, t('nav.collections')],
    ['/participant-groups', UserRoundCheck, t('nav.participantGroups')],
    ['/stats', BarChart2, t('nav.stats')],
    ...(isRootAdmin(user)
      ? ([['/admin', Users, t('nav.members')]] as NavigationItem[])
      : []),
  ];

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg font-sans text-ink">
      <AppHeader
        onProfile={() => navigate('/profile')}
        notifications={localizedNotifications}
        onOpenNotification={openNotification}
        onMarkAllNotificationsRead={markAllNotificationsRead}
      />
      <MobileNav nav={nav} label={t('nav.primaryNavigation')} />
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <Sidebar
          nav={nav}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((current) => !current)}
        />
        <main className="min-h-0 flex-1 overflow-hidden py-3">
          <ScrollArea ref={mainScrollRef} className="h-full">
            <div className="px-3 pb-3 sm:px-4 md:px-6 md:pb-6">
              <div className="mx-auto w-full max-w-[1500px]">
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
