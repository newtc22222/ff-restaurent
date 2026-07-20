import { useEffect, useRef, useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { parseVietnamMobilePhone } from '@ff-restaurent/shared';
import { useFetcher } from 'react-router';
import type { LoginActionData } from '../app/router';
import { seededUsers } from '../lib/helpers';
import { resultErrorMessage } from '../lib/result-messages';
import { useI18n } from '../app/providers/i18n';
import { useTheme } from '../app/providers/theme';
import BrandIcon from '../components/ui/BrandIcon';
import ThemeToggle from '../components/ui/ThemeToggle';
import LocaleToggle from '../components/ui/LocaleToggle';

type Mode = 'login' | 'register' | 'forgot-request' | 'forgot-reset';

/** Sign-in, registration, and enumeration-safe password recovery. */
export default function LoginPage() {
  const { locale, setLocale, t } = useI18n();
  const { theme, setTheme } = useTheme();
  const fetcher = useFetcher<LoginActionData>();
  const [mode, setMode] = useState<Mode>('login');
  const showDemoUsers = import.meta.env.DEV;
  const [identifier, setIdentifier] = useState(showDemoUsers ? 'head' : '');
  const [password, setPassword] = useState(showDemoUsers ? 'password123' : '');
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regInviteCode, setRegInviteCode] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const lastResult = useRef<LoginActionData | null>(null);
  const busy = fetcher.state !== 'idle';
  const parsedRegistrationPhone = parseVietnamMobilePhone(regPhone);
  const registrationPhoneError =
    regPhone.trim() && !parsedRegistrationPhone.success
      ? t('validation.vietnamMobilePhone')
      : null;
  const passwordError =
    newPassword && (newPassword.length < 8 || newPassword.length > 128)
      ? t('validation.passwordLength')
      : null;
  const confirmationError =
    confirmation && confirmation !== newPassword
      ? t('validation.passwordConfirmation')
      : null;

  useEffect(() => {
    if (
      fetcher.state !== 'idle' ||
      !fetcher.data ||
      lastResult.current === fetcher.data
    )
      return;
    lastResult.current = fetcher.data;
    if (fetcher.data.error) {
      toast.error(
        resultErrorMessage(fetcher.data.code, t('toast.authFailed'), t),
        {
          id: `auth-${fetcher.data.intent}-${fetcher.data.code ?? 'error'}`,
        },
      );
      return;
    }
    if (fetcher.data.success && fetcher.data.intent === 'forgot-request') {
      toast.success(t('toast.passwordResetRequested'));
      setMode('forgot-reset');
    }
    if (fetcher.data.success && fetcher.data.intent === 'forgot-reset') {
      toast.success(t('toast.passwordResetComplete'));
      setPassword('');
      setResetCode('');
      setNewPassword('');
      setConfirmation('');
      setMode('login');
    }
  }, [fetcher.data, fetcher.state, t]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    lastResult.current = null;
    const body =
      mode === 'login'
        ? {
            intent: mode,
            identifier,
            password,
            toastSuccess: t('toast.signInSuccess'),
          }
        : mode === 'register'
          ? {
              intent: mode,
              name: regName,
              username: regUsername,
              phone: regPhone,
              password: regPassword,
              inviteCode: regInviteCode,
              toastSuccess: t('toast.registerSuccess'),
            }
          : mode === 'forgot-request'
            ? { intent: mode, identifier }
            : {
                intent: mode,
                identifier,
                code: resetCode,
                newPassword,
                confirmation,
              };
    fetcher.submit(body as never, {
      method: 'post',
      encType: 'application/json',
    });
  };

  const switchMode = (next: Mode) => {
    lastResult.current = null;
    setMode(next);
  };
  const activeSeed =
    seededUsers.find(([id]) => id === identifier)?.[0] ?? 'head';
  const title =
    mode === 'register'
      ? t('auth.register')
      : mode === 'forgot-request'
        ? t('auth.forgotPassword')
        : mode === 'forgot-reset'
          ? t('auth.resetPassword')
          : t('app.name');

  return (
    <main className="grid min-h-screen place-items-center bg-bg px-4 py-10 font-sans">
      <div className="w-full max-w-[440px]">
        <div className="mb-4 flex items-center justify-end gap-2">
          <LocaleToggle locale={locale} setLocale={setLocale} />
          <ThemeToggle theme={theme} setTheme={setTheme} />
        </div>
        <form
          className="rounded-xl border border-border bg-surface p-8 shadow-panel"
          onSubmit={submit}
        >
          <div className="mb-7">
            <BrandIcon size={48} />
            <h1 className="mt-3 text-[24px] font-bold leading-tight text-ink">
              {title}
            </h1>
            {mode === 'login' && (
              <p className="mt-1 text-[14px] text-slate-500">
                {t('app.tagline')}
              </p>
            )}
            {mode.startsWith('forgot') && (
              <p className="mt-1 text-[14px] text-slate-500">
                {t('auth.resetHelp')}
              </p>
            )}
          </div>

          {mode !== 'register' && (
            <label className="mb-4 block space-y-2">
              <span className="label">{t('auth.identifier')}</span>
              <input
                className="field w-full"
                aria-label={t('auth.identifier')}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
              />
            </label>
          )}

          {mode === 'login' && (
            <>
              <label className="mb-3 block space-y-2">
                <span className="label">{t('auth.password')}</span>
                <input
                  className="field w-full"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
              <button
                type="button"
                className="mb-5 text-sm font-semibold text-ink underline"
                onClick={() => switchMode('forgot-request')}
              >
                {t('auth.forgotPassword')}
              </button>
              <button className="btn btn-primary mb-5 w-full" disabled={busy}>
                {busy ? t('auth.signingIn') : t('auth.signIn')}
              </button>
              {showDemoUsers && (
                <div className="mb-4">
                  <div className="label mb-2">{t('auth.role')}</div>
                  <div className="grid grid-cols-3 gap-2">
                    {seededUsers.map(([seedId, labelKey]) => (
                      <button
                        key={seedId}
                        type="button"
                        className={`btn px-2 ${activeSeed === seedId ? 'border border-ink bg-ink text-surface' : 'btn-soft'}`}
                        onClick={() => setIdentifier(seedId)}
                      >
                        {t(labelKey)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="text-center text-[13px] text-slate-500">
                {t('auth.noAccount')}{' '}
                <button
                  type="button"
                  className="font-semibold text-ink underline"
                  onClick={() => switchMode('register')}
                >
                  {t('auth.register')}
                </button>
              </div>
            </>
          )}

          {mode === 'register' && (
            <>
              <label className="mb-4 block space-y-2">
                <span className="label">{t('auth.name')}</span>
                <input
                  className="field w-full"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  required
                />
              </label>
              <label className="mb-4 block space-y-2">
                <span className="label">{t('auth.username')}</span>
                <input
                  className="field w-full"
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
                  aria-label={t('auth.phone')}
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  aria-invalid={!!registrationPhoneError}
                />
                {registrationPhoneError && (
                  <span className="text-xs text-red-600" role="alert">
                    {registrationPhoneError}
                  </span>
                )}
              </label>
              <label className="mb-4 block space-y-2">
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
                  onChange={(e) => setRegInviteCode(e.target.value)}
                  required
                  autoComplete="off"
                />
              </label>
              <button
                className="btn btn-primary mb-5 w-full"
                disabled={busy || !!registrationPhoneError}
              >
                {busy ? t('auth.registering') : t('auth.register')}
              </button>
              <div className="text-center text-[13px] text-slate-500">
                {t('auth.haveAccount')}{' '}
                <button
                  type="button"
                  className="font-semibold text-ink underline"
                  onClick={() => switchMode('login')}
                >
                  {t('auth.signIn')}
                </button>
              </div>
            </>
          )}

          {mode === 'forgot-request' && (
            <>
              <button className="btn btn-primary mb-4 w-full" disabled={busy}>
                {t('auth.requestReset')}
              </button>
              <button
                type="button"
                className="mb-4 w-full text-sm font-semibold text-ink underline"
                onClick={() => switchMode('forgot-reset')}
              >
                {t('auth.haveResetCode')}
              </button>
              <button
                type="button"
                className="w-full text-sm text-slate-500 underline"
                onClick={() => switchMode('login')}
              >
                {t('auth.backToSignIn')}
              </button>
            </>
          )}

          {mode === 'forgot-reset' && (
            <>
              <label className="mb-4 block space-y-2">
                <span className="label">{t('auth.resetCode')}</span>
                <input
                  className="field w-full uppercase"
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value.toUpperCase())}
                  minLength={8}
                  maxLength={8}
                  required
                  autoComplete="one-time-code"
                />
              </label>
              <label className="mb-4 block space-y-2">
                <span className="label">{t('profile.newPassword')}</span>
                <input
                  className="field w-full"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  aria-invalid={!!passwordError}
                  required
                />
                {passwordError && (
                  <span role="alert" className="text-xs text-red-600">
                    {passwordError}
                  </span>
                )}
              </label>
              <label className="mb-5 block space-y-2">
                <span className="label">{t('profile.confirmPassword')}</span>
                <input
                  className="field w-full"
                  type="password"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  aria-invalid={!!confirmationError}
                  required
                />
                {confirmationError && (
                  <span role="alert" className="text-xs text-red-600">
                    {confirmationError}
                  </span>
                )}
              </label>
              <button
                className="btn btn-primary mb-4 w-full"
                disabled={busy || !!passwordError || !!confirmationError}
              >
                {t('auth.resetPassword')}
              </button>
              <button
                type="button"
                className="w-full text-sm text-slate-500 underline"
                onClick={() => switchMode('login')}
              >
                {t('auth.backToSignIn')}
              </button>
            </>
          )}
        </form>
      </div>
    </main>
  );
}
