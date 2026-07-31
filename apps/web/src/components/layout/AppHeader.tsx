import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  MoreVertical,
  UserCircle,
} from 'lucide-react';
import { useState } from 'react';

import type { Notification } from '@/api/types';
import { useAppContext } from '@/app/providers/app-context';
import { useI18n } from '@/app/providers/i18n';
import { useTheme } from '@/app/providers/theme';
import { roleLabel } from '@/lib/permissions';

import BrandIcon from '../ui/BrandIcon';
import ConfirmDialog from '../ui/ConfirmDialog';
import LocaleToggle from '../ui/LocaleToggle';
import ScrollArea from '../ui/ScrollArea';
import ThemeToggle from '../ui/ThemeToggle';
import UserAvatar from '../ui/UserAvatar';

interface AppHeaderProps {
  onProfile?: () => void;
  notifications?: Notification[];
  onOpenNotification?: (notification: Notification) => void;
  onMarkAllNotificationsRead?: () => void;
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

/** Shared app header with desktop actions and a compact mobile context menu. */
export default function AppHeader({
  onProfile,
  notifications = [],
  onOpenNotification,
  onMarkAllNotificationsRead,
  sidebarCollapsed = false,
  onToggleSidebar,
}: AppHeaderProps) {
  const { user, logout } = useAppContext();
  const { locale, setLocale, t } = useI18n();
  const { theme, setTheme } = useTheme();
  const [showConfirm, setShowConfirm] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const unreadCount = notifications.filter((item) => !item.readAt).length;
  const localeControlProps = {
    locale,
    setLocale,
    label: t('nav.language'),
    englishLabel: t('language.english'),
    vietnameseLabel: t('language.vietnamese'),
  };
  const themeControlProps = {
    theme,
    setTheme,
    label: t('nav.theme'),
    lightLabel: t('theme.light'),
    darkLabel: t('theme.dark'),
    systemLabel: t('theme.system'),
  };

  const openProfile = () => {
    setShowMenu(false);
    setShowUserMenu(false);
    onProfile?.();
  };

  const openSignOut = () => {
    setShowMenu(false);
    setShowUserMenu(false);
    setShowConfirm(true);
  };

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center border-b border-border bg-surface px-3 md:px-5">
        {onToggleSidebar && (
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-muted hover:text-ink md:hidden"
            onClick={() => {
              setShowMenu(false);
              setShowNotifications(false);
              onToggleSidebar();
            }}
            aria-label={
              sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'
            }
            aria-expanded={!sidebarCollapsed}
          >
            <Menu size={19} />
          </button>
        )}

        <div
          className="absolute left-1/2 flex -translate-x-1/2 items-center gap-2 md:static md:translate-x-0"
          data-testid="app-brand"
        >
          <BrandIcon size={32} />
          <span className="whitespace-nowrap text-sm font-bold text-ink">
            {t('app.name')}
          </span>
        </div>

        <div className="hidden min-w-0 flex-1 md:block" />

        <div className="ml-auto hidden items-center gap-2 md:flex">
          <LocaleToggle {...localeControlProps} />
          <ThemeToggle {...themeControlProps} />
          {onOpenNotification && (
            <button
              type="button"
              className="relative flex h-8 w-8 items-center justify-center rounded-md border border-border text-slate-500 hover:bg-muted hover:text-ink"
              onClick={() => setShowNotifications((current) => !current)}
              aria-label={t('nav.notifications')}
              aria-expanded={showNotifications}
            >
              <Bell size={15} />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-saffron px-1 text-2xs font-bold leading-4 text-white">
                  {unreadCount}
                </span>
              )}
            </button>
          )}
          <div className="relative">
            <button
              type="button"
              className="flex items-center gap-2 rounded-md px-2 py-1 text-compact text-slate-500 transition-colors hover:bg-muted hover:text-ink"
              onClick={() => {
                setShowNotifications(false);
                setShowUserMenu((current) => !current);
              }}
              aria-label={`${user.name}, ${roleLabel(user, t)}`}
              aria-expanded={showUserMenu}
              aria-haspopup="menu"
            >
              <UserAvatar
                name={user.name}
                avatarUrl={user.avatarUrl}
                size="sm"
              />
              <span className="min-w-0 max-w-44 text-left leading-tight">
                <span className="block truncate text-compact font-semibold text-ink">
                  {user.name}
                </span>
                <span className="mt-0.5 block truncate text-2xs text-slate-500">
                  {roleLabel(user, t)}
                </span>
              </span>
              <ChevronDown
                size={12}
                className={`transition-transform ${showUserMenu ? 'rotate-180' : ''}`}
              />
            </button>

            {showUserMenu && (
              <>
                <div
                  className="fixed inset-0 z-50"
                  aria-hidden="true"
                  onClick={() => setShowUserMenu(false)}
                />
                <div
                  className="absolute right-0 top-11 z-[60] w-48 rounded-lg border border-border bg-surface p-1.5 shadow-panel"
                  role="menu"
                >
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-compact font-medium text-ink transition-colors hover:bg-muted"
                    onClick={openProfile}
                  >
                    <UserCircle size={15} className="text-slate-500" />
                    {t('profile.title')}
                  </button>
                  <div className="my-1 border-t border-border" />
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-compact font-semibold text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50"
                    onClick={openSignOut}
                  >
                    <LogOut size={15} /> {t('auth.signOut')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="relative ml-auto md:hidden">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-muted hover:text-ink"
            onClick={() => {
              setShowNotifications(false);
              if (!sidebarCollapsed) onToggleSidebar?.();
              setShowMenu((current) => !current);
            }}
            aria-label={t('nav.menu')}
            aria-expanded={showMenu}
          >
            <MoreVertical size={19} />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-11 z-50 w-64 rounded-xl border border-border bg-surface p-2 shadow-panel">
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-muted"
                onClick={openProfile}
              >
                <UserAvatar
                  name={user.name}
                  avatarUrl={user.avatarUrl}
                  size="sm"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">
                    {user.name}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {roleLabel(user, t)}
                  </span>
                </span>
              </button>

              <div className="my-1 border-t border-border" />
              <div className="flex items-center justify-between rounded-lg px-3 py-1.5 text-sm font-medium text-ink">
                <span>{t('nav.language')}</span>
                <LocaleToggle {...localeControlProps} />
              </div>
              <div className="flex items-center justify-between rounded-lg px-3 py-1.5 text-sm font-medium text-ink">
                <span>{t('nav.theme')}</span>
                <ThemeToggle {...themeControlProps} />
              </div>
              {onOpenNotification && (
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-ink hover:bg-muted"
                  onClick={() => {
                    setShowMenu(false);
                    setShowNotifications(true);
                  }}
                >
                  <Bell size={18} className="text-slate-500" />
                  <span className="flex-1 text-left">
                    {t('nav.notifications')}
                  </span>
                  {unreadCount > 0 && (
                    <span className="min-w-5 rounded-full bg-saffron px-1.5 text-center text-2xs font-bold leading-5 text-white">
                      {unreadCount}
                    </span>
                  )}
                </button>
              )}
              <div className="my-1 border-t border-border" />
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                onClick={openSignOut}
              >
                <LogOut size={18} /> {t('auth.signOut')}
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="h-14 shrink-0" aria-hidden="true" />

      {showNotifications && onOpenNotification && (
        <>
          <div
            className="fixed inset-0 z-[55]"
            aria-hidden="true"
            data-testid="notification-backdrop"
            onClick={() => setShowNotifications(false)}
          />
          <div
            className="fixed left-3 right-3 top-16 z-[60] overflow-hidden rounded-xl border border-border bg-surface shadow-panel sm:left-auto sm:right-4 sm:w-[22rem]"
            role="menu"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-bold">
                {t('nav.notifications')}
              </span>
              <div className="flex items-center gap-3">
                {unreadCount > 0 && onMarkAllNotificationsRead && (
                  <button
                    type="button"
                    className="text-xs font-semibold text-saffron hover:opacity-80"
                    onClick={onMarkAllNotificationsRead}
                  >
                    {t('notifications.markAllRead')}
                  </button>
                )}
                <button
                  type="button"
                  className="text-xs font-semibold text-slate-500 hover:text-ink"
                  onClick={() => setShowNotifications(false)}
                >
                  {t('auth.cancel')}
                </button>
              </div>
            </div>
            <ScrollArea className="h-80">
              {notifications.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-slate-500">
                  {t('notifications.empty')}
                </p>
              ) : (
                notifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    className={`block w-full border-b border-border px-4 py-3 text-left text-sm last:border-0 hover:bg-muted ${
                      !notification.readAt ? 'chip-saffron' : ''
                    }`}
                    onClick={() => {
                      setShowNotifications(false);
                      onOpenNotification(notification);
                    }}
                  >
                    <span className="block font-medium text-ink">
                      {notification.message}
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">
                      {new Date(notification.createdAt).toLocaleString()}
                    </span>
                  </button>
                ))
              )}
            </ScrollArea>
          </div>
        </>
      )}

      {showConfirm && (
        <ConfirmDialog
          title={t('auth.confirmSignOutTitle')}
          message={t('auth.confirmSignOut')}
          onConfirm={() => {
            setShowConfirm(false);
            logout();
          }}
          onCancel={() => setShowConfirm(false)}
          t={t}
        />
      )}
    </>
  );
}
