import { FormEvent, useState } from 'react';
import { Edit3 } from 'lucide-react';
import { parseVietnamMobilePhone } from '@ff-restaurent/shared';
import { useNavigate } from 'react-router';
import { roleLabel, initials } from '../lib/helpers';
import { useAppContext } from '../app/providers/app-context';
import { useI18n } from '../app/providers/i18n';
import { useMutation } from '../hooks/useMutation';
import BackButton from '../components/ui/BackButton';

/**
 * ProfilePage displays user profile credentials and displays a form to update them.
 */
export default function ProfilePage() {
  const navigate = useNavigate();
  const { user } = useAppContext();
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: user.name,
    username: user.username,
    phone: user.phone ?? '',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmation: '',
  });
  const { mutate } = useMutation();
  const parsedPhone = parseVietnamMobilePhone(form.phone);
  const phoneError =
    form.phone.trim() && !parsedPhone.success
      ? t('validation.vietnamMobilePhone')
      : null;
  const passwordLengthError =
    passwordForm.newPassword &&
    (passwordForm.newPassword.length < 8 ||
      passwordForm.newPassword.length > 128)
      ? t('validation.passwordLength')
      : null;
  const passwordReuseError =
    passwordForm.currentPassword &&
    passwordForm.newPassword === passwordForm.currentPassword
      ? t('validation.passwordReuse')
      : null;
  const passwordConfirmationError =
    passwordForm.confirmation &&
    passwordForm.confirmation !== passwordForm.newPassword
      ? t('validation.passwordConfirmation')
      : null;

  const onBack = () => navigate('/bills');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!parsedPhone.success) return;
    void mutate(
      {
        intent: 'update-profile',
        payload: {
          name: form.name,
          username: form.username,
          phone: parsedPhone.phone,
        },
      },
      {
        fallback: t('toast.profileUpdateFailed'),
        success: t('toast.profileUpdated'),
        onSuccess: () => setEditing(false),
      },
    );
  };

  const changePassword = (event: FormEvent) => {
    event.preventDefault();
    if (passwordLengthError || passwordReuseError || passwordConfirmationError)
      return;
    void mutate(
      { intent: 'change-password', payload: passwordForm },
      {
        fallback: t('toast.passwordChangeFailed'),
        success: t('toast.passwordChanged'),
        onSuccess: () =>
          setPasswordForm({
            currentPassword: '',
            newPassword: '',
            confirmation: '',
          }),
      },
    );
  };

  return (
    <div className="mx-auto w-full max-w-md py-2">
      <BackButton onClick={onBack} label={t('bills.backToBills')} />

      <div className="panel p-6">
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#e9900c] text-[24px] font-bold text-white">
            {initials(user.name)}
          </div>
          <div>
            <h2 className="text-[20px] font-bold text-ink">{user.name}</h2>
            <p className="text-[13px] text-slate-500">
              @{user.username} / {roleLabel(user, t)}
            </p>
            {user.phone && (
              <p className="text-[13px] text-slate-500">{user.phone}</p>
            )}
          </div>
        </div>

        {!editing ? (
          <button
            className="btn btn-soft w-full"
            onClick={() => setEditing(true)}
          >
            <Edit3 size={14} /> {t('profile.edit')}
          </button>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <label className="block space-y-1">
              <span className="label">{t('auth.name')}</span>
              <input
                className="field w-full"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </label>
            <label className="block space-y-1">
              <span className="label">{t('auth.username')}</span>
              <input
                className="field w-full"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                required
              />
            </label>
            <label className="block space-y-1">
              <span className="label">{t('auth.phone')}</span>
              <input
                className="field w-full"
                type="tel"
                aria-label={t('auth.phone')}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                aria-invalid={!!phoneError}
              />
              {phoneError && (
                <span className="text-xs text-red-600" role="alert">
                  {phoneError}
                </span>
              )}
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                className="btn btn-soft flex-1"
                onClick={() => setEditing(false)}
              >
                {t('auth.cancel')}
              </button>
              <button
                className="btn btn-primary flex-1"
                disabled={!!phoneError}
              >
                {t('profile.save')}
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="panel mt-4 p-6">
        <h2 className="text-lg font-bold text-ink">
          {t('profile.notificationPreferences')}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {t('profile.notificationPreferencesDescription')}
        </p>
        <label className="mt-4 flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-border p-4">
          <span className="text-sm font-semibold text-ink">
            {t('profile.paymentReminders')}
          </span>
          <input
            type="checkbox"
            aria-label={t('profile.paymentReminders')}
            checked={user.paymentRemindersEnabled !== false}
            onChange={(event) =>
              void mutate(
                {
                  intent: 'notification-preferences',
                  payload: { paymentRemindersEnabled: event.target.checked },
                },
                {
                  fallback: t('toast.notificationPreferencesFailed'),
                  success: t('toast.notificationPreferencesUpdated'),
                },
              )
            }
          />
        </label>
      </div>

      <div className="panel mt-4 p-6">
        <h2 className="text-lg font-bold text-ink">
          {t('profile.changePassword')}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {t('profile.changePasswordDescription')}
        </p>
        <form className="mt-5 space-y-4" onSubmit={changePassword}>
          <label className="block space-y-1">
            <span className="label">{t('profile.currentPassword')}</span>
            <input
              className="field w-full"
              type="password"
              aria-label={t('profile.currentPassword')}
              autoComplete="current-password"
              value={passwordForm.currentPassword}
              onChange={(event) =>
                setPasswordForm({
                  ...passwordForm,
                  currentPassword: event.target.value,
                })
              }
              required
            />
          </label>
          <label className="block space-y-1">
            <span className="label">{t('profile.newPassword')}</span>
            <input
              className="field w-full"
              type="password"
              aria-label={t('profile.newPassword')}
              autoComplete="new-password"
              value={passwordForm.newPassword}
              onChange={(event) =>
                setPasswordForm({
                  ...passwordForm,
                  newPassword: event.target.value,
                })
              }
              aria-invalid={!!passwordLengthError || !!passwordReuseError}
              required
            />
            {(passwordLengthError || passwordReuseError) && (
              <span className="text-xs text-red-600" role="alert">
                {passwordLengthError || passwordReuseError}
              </span>
            )}
          </label>
          <label className="block space-y-1">
            <span className="label">{t('profile.confirmPassword')}</span>
            <input
              className="field w-full"
              type="password"
              aria-label={t('profile.confirmPassword')}
              autoComplete="new-password"
              value={passwordForm.confirmation}
              onChange={(event) =>
                setPasswordForm({
                  ...passwordForm,
                  confirmation: event.target.value,
                })
              }
              aria-invalid={!!passwordConfirmationError}
              required
            />
            {passwordConfirmationError && (
              <span className="text-xs text-red-600" role="alert">
                {passwordConfirmationError}
              </span>
            )}
          </label>
          <button
            className="btn btn-primary w-full"
            disabled={
              !passwordForm.currentPassword ||
              !passwordForm.newPassword ||
              !passwordForm.confirmation ||
              !!passwordLengthError ||
              !!passwordReuseError ||
              !!passwordConfirmationError
            }
          >
            {t('profile.changePasswordAction')}
          </button>
        </form>
      </div>
    </div>
  );
}
