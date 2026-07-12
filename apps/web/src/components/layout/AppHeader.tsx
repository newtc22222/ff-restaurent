import { useState } from 'react';
import { Bell, LogOut, UserCircle } from 'lucide-react';
import type { Notification } from '../../lib/api.js';
import { roleLabel } from '../../lib/helpers.js';
import { useAppContext } from '../../app/providers/app-context.js';
import { useI18n } from '../../app/providers/i18n.js';
import { useTheme } from '../../app/providers/theme.js';
import BrandIcon from '../ui/BrandIcon.js';
import ThemeToggle from '../ui/ThemeToggle.js';
import LocaleToggle from '../ui/LocaleToggle.js';
import ConfirmDialog from '../ui/ConfirmDialog.js';

interface AppHeaderProps {
  /**
   * Optional callback to navigate to profile page.
   */
  onProfile?: () => void;
  notifications?: Notification[];
  onOpenNotification?: (notification: Notification) => void;
}

/**
 * AppHeader renders the top navigation bar containing branding, setting toggles, and user actions.
 * Reads the current user and sign-out action from the app context, so it can only be rendered
 * inside an authenticated route.
 */
export default function AppHeader({
  onProfile,
  notifications = [],
  onOpenNotification,
}: AppHeaderProps) {
  const { user, logout } = useAppContext();
  const { locale, setLocale, t } = useI18n();
  const { theme, setTheme } = useTheme();
  const [showConfirm, setShowConfirm] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadCount = notifications.filter((item) => !item.readAt).length;

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center gap-3 border-b border-border bg-surface px-4 md:px-5">
        <BrandIcon size={32} />
        <div className="min-w-0 flex-1">
          <span className="text-[15px] font-bold text-ink">
            {t('app.name')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onOpenNotification && (
            <div className="relative">
              <button
                className="relative flex h-8 w-8 items-center justify-center rounded-md border border-border text-slate-500 hover:bg-muted hover:text-ink"
                onClick={() => setShowNotifications((current) => !current)}
                aria-label={t('nav.notifications')}
              >
                <Bell size={15} />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-[#e9900c] px-1 text-[10px] font-bold leading-4 text-white">
                    {unreadCount}
                  </span>
                )}
              </button>
              {showNotifications && (
                <div className="absolute right-0 top-10 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-surface shadow-panel">
                  <div className="border-b border-border px-4 py-3 text-sm font-bold">
                    {t('nav.notifications')}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="px-4 py-6 text-center text-sm text-slate-500">
                        {t('notifications.empty')}
                      </p>
                    ) : (
                      notifications.map((notification) => (
                        <button
                          key={notification.id}
                          className={`block w-full border-b border-border px-4 py-3 text-left text-sm last:border-0 hover:bg-muted ${!notification.readAt ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''}`}
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
                  </div>
                </div>
              )}
            </div>
          )}
          <LocaleToggle locale={locale} setLocale={setLocale} />
          <ThemeToggle theme={theme} setTheme={setTheme} />
          <button
            className="hidden items-center gap-2 rounded-md px-2 py-1 text-[13px] text-slate-500 transition-colors hover:bg-muted hover:text-ink sm:flex"
            onClick={onProfile}
          >
            <UserCircle size={16} />
            <span className="font-semibold">{user.name}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold">
              {roleLabel(user, t)}
            </span>
          </button>
          <button
            className="btn btn-soft h-8 px-3 text-[13px]"
            onClick={() => setShowConfirm(true)}
          >
            <LogOut size={13} /> {t('auth.signOut')}
          </button>
        </div>
      </header>
      <div className="h-14 shrink-0" aria-hidden="true" />
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
