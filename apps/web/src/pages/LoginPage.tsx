import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import toast from 'react-hot-toast';
import { useFetcher } from 'react-router';
import type { LoginActionData } from '../app/router';
import { seededUsers } from '../lib/helpers';
import { resultErrorMessage } from '../lib/result-messages';
import { useI18n } from '../app/providers/i18n';
import { useTheme } from '../app/providers/theme';
import BrandIcon from '../components/ui/BrandIcon';
import ThemeToggle from '../components/ui/ThemeToggle';
import LocaleToggle from '../components/ui/LocaleToggle';

/**
 * LoginPage handles sign-in and user registration, including pre-seeded quick logins.
 */
export default function LoginPage() {
  const { locale, setLocale, t } = useI18n();
  const { theme, setTheme } = useTheme();
  const fetcher = useFetcher<LoginActionData>();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const showDemoUsers = import.meta.env.DEV;
  const [identifier, setIdentifier] = useState(showDemoUsers ? 'head' : '');
  const [password, setPassword] = useState(showDemoUsers ? 'password123' : '');
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regInviteCode, setRegInviteCode] = useState('');
  const lastError = useRef<LoginActionData | null>(null);
  const busy = fetcher.state !== 'idle';

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.error) {
      if (lastError.current !== fetcher.data) {
        lastError.current = fetcher.data;
        toast.error(
          resultErrorMessage(fetcher.data.code, t('toast.authFailed'), t),
          { id: `auth-${fetcher.data.intent}-${fetcher.data.code ?? 'error'}` },
        );
      }
    }
  }, [fetcher.data, fetcher.state, t]);

  const submitLogin = (event: SubmitEvent) => {
    event.preventDefault();
    lastError.current = null;
    fetcher.submit(
      {
        intent: 'login',
        identifier,
        password,
        toastSuccess: t('toast.signInSuccess'),
      },
      { method: 'post', encType: 'application/json' },
    );
  };

  const submitRegister = (event: SubmitEvent) => {
    event.preventDefault();
    lastError.current = null;
    fetcher.submit(
      {
        intent: 'register',
        name: regName,
        username: regUsername,
        phone: regPhone,
        password: regPassword,
        inviteCode: regInviteCode,
        toastSuccess: t('toast.registerSuccess'),
      },
      { method: 'post', encType: 'application/json' },
    );
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
            <label className="mb-5 block space-y-2">
              <span className="label">{t('auth.identifier')}</span>
              <input
                className="field w-full"
                type="text"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
              />
            </label>
            <label className="mb-5 block space-y-2">
              <span className="label">{t('auth.password')}</span>
              <input
                className="field w-full"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <button className="btn btn-primary mb-5 w-full" disabled={busy}>
              {busy ? t('auth.signingIn') : t('auth.signIn')}
            </button>
            {showDemoUsers && (
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
                        }}
                      >
                        {t(labelKey)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="text-center text-[13px] text-slate-500">
              {t('auth.noAccount')}{' '}
              <button
                type="button"
                className="font-semibold text-ink underline"
                onClick={() => {
                  setMode('register');
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
            <label className="mb-4 block space-y-2">
              <span className="label">{t('auth.name')}</span>
              <input
                className="field w-full"
                type="text"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                required
              />
            </label>
            <label className="mb-4 block space-y-2">
              <span className="label">{t('auth.username')}</span>
              <input
                className="field w-full"
                type="text"
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
                required
              />
            </label>
            <label className="mb-4 block space-y-2">
              <span className="label">{t('auth.phone')}</span>
              <input
                className="field w-full"
                type="tel"
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
              />
            </label>
            <label className="mb-5 block space-y-2">
              <span className="label">{t('auth.password')}</span>
              <input
                className="field w-full"
                type="password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                required
                minLength={8}
              />
            </label>
            <label className="mb-5 block space-y-2">
              <span className="label">{t('auth.inviteCode')}</span>
              <input
                className="field w-full"
                type="password"
                value={regInviteCode}
                onChange={(event) => setRegInviteCode(event.target.value)}
                required
                autoComplete="off"
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
