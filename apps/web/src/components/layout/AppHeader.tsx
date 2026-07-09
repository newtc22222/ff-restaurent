import { useState } from 'react';
import { LogOut, UserCircle } from 'lucide-react';
import type { User } from '../../api.js';
import type { Locale } from '../../i18n.js';
import type { Theme } from '../../theme.js';
import { roleLabel } from '../../utils/helpers.js';
import BrandIcon from '../ui/BrandIcon.js';
import ThemeToggle from '../ui/ThemeToggle.js';
import LocaleToggle from '../ui/LocaleToggle.js';
import ConfirmDialog from '../ui/ConfirmDialog.js';

interface AppHeaderProps {
  /**
   * Current authenticated user.
   */
  user: User;
  /**
   * Callback fired when signing out.
   */
  onSignOut: () => void;
  /**
   * Translation utility function.
   */
  t: (key: string) => string;
  /**
   * Current active locale.
   */
  locale: Locale;
  /**
   * Callback to update locale.
   */
  setLocale: (locale: Locale) => void;
  /**
   * Current active theme.
   */
  theme: Theme;
  /**
   * Callback to update theme.
   */
  setTheme: (theme: Theme) => void;
  /**
   * Optional callback to navigate to profile page.
   */
  onProfile?: () => void;
}

/**
 * AppHeader renders the top navigation bar containing branding, setting toggles, and user actions.
 */
export default function AppHeader({
  user,
  onSignOut,
  t,
  locale,
  setLocale,
  theme,
  setTheme,
  onProfile,
}: AppHeaderProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4 md:px-5">
        <BrandIcon size={32} />
        <div className="min-w-0 flex-1">
          <span className="text-[15px] font-bold text-ink">
            {t('app.name')}
          </span>
        </div>
        <div className="flex items-center gap-2">
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
      {showConfirm && (
        <ConfirmDialog
          title={t('auth.confirmSignOutTitle')}
          message={t('auth.confirmSignOut')}
          onConfirm={() => {
            setShowConfirm(false);
            onSignOut();
          }}
          onCancel={() => setShowConfirm(false)}
          t={t}
        />
      )}
    </>
  );
}
