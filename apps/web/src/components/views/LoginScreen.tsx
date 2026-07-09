import { FormEvent, useEffect, useState } from 'react';
import type { Locale } from '../../i18n.js';
import type { Theme } from '../../theme.js';
import { seededUsers } from '../../utils/helpers.js';
import BrandIcon from '../ui/BrandIcon.js';
import ThemeToggle from '../ui/ThemeToggle.js';
import LocaleToggle from '../ui/LocaleToggle.js';

interface LoginScreenProps {
  /**
   * Callback to perform authentication/login api request.
   */
  onLogin: (identifier: string, password: string) => Promise<void>;
  /**
   * Callback to perform user registration api request.
   */
  onRegister: (
    name: string,
    username: string,
    phone: string,
    password: string,
  ) => Promise<void>;
  /**
   * Error message returned from authentication attempts.
   */
  error: string | null;
  /**
   * Translation utility function.
   */
  t: (key: string) => string;
  /**
   * Current active locale.
   */
  locale: Locale;
  /**
   * Callback to set locale.
   */
  setLocale: (locale: Locale) => void;
  /**
   * Current active theme.
   */
  theme: Theme;
  /**
   * Callback to set theme.
   */
  setTheme: (theme: Theme) => void;
}

/**
 * LoginScreen handles sign-in and user registration, including pre-seeded quick logins.
 */
export default function LoginScreen({
  onLogin,
  onRegister,
  error,
  t,
  locale,
  setLocale,
  theme,
  setTheme,
}: LoginScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [identifier, setIdentifier] = useState('head');
  const [password, setPassword] = useState('password123');
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [activeError, setActiveError] = useState<string | null>(null);

  useEffect(() => {
    setActiveError(error);
  }, [error]);

  const clearError = () => {
    if (activeError) {
      setActiveError(null);
    }
  };

  const submitLogin = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setActiveError(null);
    try {
      await onLogin(identifier, password);
    } catch (err) {
      setActiveError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  const submitRegister = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setActiveError(null);
    try {
      await onRegister(regName, regUsername, regPhone, regPassword);
    } catch (err) {
      setActiveError(
        err instanceof Error ? err.message : 'Registration failed',
      );
    } finally {
      setBusy(false);
    }
  };

  const activeSeed =
    seededUsers.find(([seedId]) => seedId === identifier)?.[0] ?? 'head';

  return (
    <main className="grid min-h-screen place-items-center bg-bg px-4 py-10 font-sans">
      <div className="w-full max-w-[440px]">
        <div className="mb-4 flex items-center justify-end gap-2">
          <LocaleToggle locale={locale} setLocale={setLocale} />
          <ThemeToggle theme={theme} setTheme={setTheme} />
        </div>

        {mode === 'login' ? (
          <form
            className="rounded-xl border border-border bg-surface p-8 shadow-panel"
            onSubmit={submitLogin}
          >
            <div className="mb-7">
              <BrandIcon size={48} />
              <h1 className="mt-3 text-[24px] font-bold leading-tight text-ink">
                {t('app.name')}
              </h1>
              <p className="mt-1 text-[14px] text-slate-500">
                {t('app.tagline')}
              </p>
            </div>
            {activeError && (
              <div className="mb-5 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                {activeError}
              </div>
            )}
            <label className="mb-5 block space-y-2">
              <span className="label">{t('auth.identifier')}</span>
              <input
                className="field w-full"
                type="text"
                value={identifier}
                onChange={(event) => {
                  setIdentifier(event.target.value);
                  clearError();
                }}
                onFocus={clearError}
              />
            </label>
            <label className="mb-5 block space-y-2">
              <span className="label">{t('auth.password')}</span>
              <input
                className="field w-full"
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  clearError();
                }}
                onFocus={clearError}
              />
            </label>
            <button className="btn btn-primary mb-5 w-full" disabled={busy}>
              {busy ? t('auth.signingIn') : t('auth.signIn')}
            </button>
            <div className="mb-4">
              <div className="label mb-2">{t('auth.role')}</div>
              <div className="grid grid-cols-3 gap-2">
                {seededUsers.map(([seedId, labelKey]) => {
                  const isActive = activeSeed === seedId;
                  return (
                    <button
                      key={seedId}
                      type="button"
                      className={`btn px-2 ${
                        isActive
                          ? 'border border-ink bg-ink text-white dark:bg-[hsl(210,20%,92%)] dark:text-[hsl(220,15%,9%)]'
                          : 'btn-soft'
                      }`}
                      onClick={() => {
                        setIdentifier(seedId);
                        clearError();
                      }}
                    >
                      {t(labelKey)}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="text-center text-[13px] text-slate-500">
              {t('auth.noAccount')}{' '}
              <button
                type="button"
                className="font-semibold text-ink underline"
                onClick={() => {
                  setMode('register');
                  clearError();
                }}
              >
                {t('auth.register')}
              </button>
            </div>
          </form>
        ) : (
          <form
            className="rounded-xl border border-border bg-surface p-8 shadow-panel"
            onSubmit={submitRegister}
          >
            <div className="mb-7">
              <BrandIcon size={48} />
              <h1 className="mt-3 text-[24px] font-bold leading-tight text-ink">
                {t('auth.register')}
              </h1>
            </div>
            {activeError && (
              <div className="mb-5 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                {activeError}
              </div>
            )}
            <label className="mb-4 block space-y-2">
              <span className="label">{t('auth.name')}</span>
              <input
                className="field w-full"
                type="text"
                value={regName}
                onChange={(e) => {
                  setRegName(e.target.value);
                  clearError();
                }}
                onFocus={clearError}
                required
              />
            </label>
            <label className="mb-4 block space-y-2">
              <span className="label">{t('auth.username')}</span>
              <input
                className="field w-full"
                type="text"
                value={regUsername}
                onChange={(e) => {
                  setRegUsername(e.target.value);
                  clearError();
                }}
                onFocus={clearError}
                required
              />
            </label>
            <label className="mb-4 block space-y-2">
              <span className="label">{t('auth.phone')}</span>
              <input
                className="field w-full"
                type="tel"
                value={regPhone}
                onChange={(e) => {
                  setRegPhone(e.target.value);
                  clearError();
                }}
                onFocus={clearError}
              />
            </label>
            <label className="mb-5 block space-y-2">
              <span className="label">{t('auth.password')}</span>
              <input
                className="field w-full"
                type="password"
                value={regPassword}
                onChange={(e) => {
                  setRegPassword(e.target.value);
                  clearError();
                }}
                onFocus={clearError}
                required
                minLength={8}
              />
            </label>
            <button className="btn btn-primary mb-5 w-full" disabled={busy}>
              {busy ? t('auth.registering') : t('auth.register')}
            </button>
            <div className="text-center text-[13px] text-slate-500">
              {t('auth.haveAccount')}{' '}
              <button
                type="button"
                className="font-semibold text-ink underline"
                onClick={() => {
                  setMode('login');
                  clearError();
                }}
              >
                {t('auth.signIn')}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
