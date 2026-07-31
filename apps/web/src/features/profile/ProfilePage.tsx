import { Edit3, Plus, QrCode, Trash2 } from 'lucide-react';
import { FormEvent, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router';

import { parseVietnamMobilePhone } from '@ff-restaurent/shared';

import type { PaymentQrImage } from '@/api/types';
import { useAppContext } from '@/app/providers/app-context';
import { useI18n } from '@/app/providers/i18n';
import BackButton from '@/components/ui/BackButton';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import ImagePicker from '@/components/ui/ImagePicker';
import Modal from '@/components/ui/Modal';
import { useRouteMutation } from '@/hooks/useRouteMutation';
import { canChef, roleLabel } from '@/lib/permissions';
import { initials } from '@/lib/user-display';

import {
  usePaymentQrImages,
  useProfileMediaMutations,
} from './profile-media.queries';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, refresh = async () => undefined } = useAppContext();
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
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [editingQr, setEditingQr] = useState<PaymentQrImage | null>(null);
  const [qrLabel, setQrLabel] = useState('');
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [deletingQr, setDeletingQr] = useState<PaymentQrImage | null>(null);
  const { mutate } = useRouteMutation();
  const qrImagesQuery = usePaymentQrImages(canChef(user), user.id);
  const qrImages = qrImagesQuery.data ?? [];
  const {
    uploadAvatar: uploadAvatarMutation,
    removeAvatar: removeAvatarMutation,
    savePaymentQr: savePaymentQrMutation,
    removePaymentQr: removePaymentQrMutation,
  } = useProfileMediaMutations();
  const mediaBusy =
    uploadAvatarMutation.isPending ||
    removeAvatarMutation.isPending ||
    savePaymentQrMutation.isPending ||
    removePaymentQrMutation.isPending;
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

  const uploadAvatar = async (file: File | null) => {
    if (!file) return;
    try {
      await uploadAvatarMutation.mutateAsync(file);
      await refresh();
      toast.success('Avatar updated.');
    } catch {
      toast.error('Could not upload the avatar.');
    }
  };

  const removeAvatar = async () => {
    try {
      await removeAvatarMutation.mutateAsync();
      await refresh();
      toast.success('Avatar removed.');
    } catch {
      toast.error('Could not remove the avatar.');
    }
  };

  const openQrModal = (qr?: PaymentQrImage) => {
    setEditingQr(qr ?? null);
    setQrLabel(qr?.label ?? '');
    setQrFile(null);
    setQrModalOpen(true);
  };

  const saveQr = async () => {
    if (!qrLabel.trim() || (!editingQr && !qrFile)) return;
    try {
      await savePaymentQrMutation.mutateAsync({
        id: editingQr?.id,
        label: qrLabel.trim(),
        file: qrFile,
      });
      setQrModalOpen(false);
      toast.success(editingQr ? 'Payment QR updated.' : 'Payment QR added.');
    } catch {
      toast.error('Could not save the payment QR image.');
    }
  };

  const removeQr = async () => {
    if (!deletingQr) return;
    try {
      await removePaymentQrMutation.mutateAsync(deletingQr.id);
      setDeletingQr(null);
      toast.success('Payment QR removed.');
    } catch {
      toast.error('Could not remove the payment QR image.');
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl py-2">
      <BackButton
        onClick={() => navigate('/bills')}
        label={t('bills.backToBills')}
      />
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="space-y-4">
          <section className="panel p-6">
            <div className="mb-6 flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-saffron text-xl font-bold text-white">
                {user.avatarUrl ? (
                  <img
                    className="h-full w-full object-cover"
                    src={user.avatarUrl}
                    alt=""
                  />
                ) : (
                  initials(user.name)
                )}
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-xl font-bold text-ink">
                  {user.name}
                </h2>
                <p className="text-compact text-slate-500">
                  @{user.username} / {roleLabel(user, t)}
                </p>
                {user.phone && (
                  <p className="text-compact text-slate-500">{user.phone}</p>
                )}
              </div>
            </div>
            <ImagePicker
              label={t('profile.avatar')}
              currentUrl={user.avatarUrl}
              maxSizeMb={5}
              onFile={(file) => void uploadAvatar(file)}
              onRemove={() => void removeAvatar()}
            />
            {!editing ? (
              <button
                className="btn btn-soft mt-4 w-full"
                onClick={() => setEditing(true)}
              >
                <Edit3 size={14} /> {t('profile.edit')}
              </button>
            ) : (
              <form onSubmit={submit} className="mt-4 space-y-4">
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
                    onChange={(e) =>
                      setForm({ ...form, username: e.target.value })
                    }
                    required
                  />
                </label>
                <label className="block space-y-1">
                  <span className="label">{t('auth.phone')}</span>
                  <input
                    className="field w-full"
                    type="tel"
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
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
          </section>

          <section className="panel p-6">
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
                checked={user.paymentRemindersEnabled !== false}
                onChange={(event) =>
                  void mutate(
                    {
                      intent: 'notification-preferences',
                      payload: {
                        paymentRemindersEnabled: event.target.checked,
                      },
                    },
                    {
                      fallback: t('toast.notificationPreferencesFailed'),
                      success: t('toast.notificationPreferencesUpdated'),
                    },
                  )
                }
              />
            </label>
          </section>
        </div>

        <div className="space-y-4">
          {canChef(user) && (
            <section className="panel p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
                    <QrCode size={19} /> {t('profile.qrTitle')}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {t('profile.qrDescription')}
                  </p>
                </div>
                <button
                  className="btn btn-primary"
                  disabled={qrImages.length >= 5}
                  onClick={() => openQrModal()}
                >
                  <Plus size={14} /> {t('profile.qrAdd')}
                </button>
              </div>
              {qrImagesQuery.isPending && (
                <p className="mt-4 text-sm text-slate-500" role="status">
                  {t('common.loading')}
                </p>
              )}
              {qrImagesQuery.isError && (
                <button
                  type="button"
                  className="mt-4 text-sm font-semibold text-red-600 hover:underline dark:text-red-400"
                  onClick={() => void qrImagesQuery.refetch()}
                >
                  {t('common.retry')}
                </button>
              )}
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {qrImages.map((qr) => (
                  <article
                    key={qr.id}
                    className="rounded-lg border border-border p-3"
                  >
                    <img
                      src={qr.imageUrl}
                      alt={qr.label}
                      className="aspect-square w-full rounded-md bg-white object-contain"
                    />
                    <p className="mt-2 truncate text-sm font-semibold text-ink">
                      {qr.label}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        className="btn btn-soft flex-1 text-xs"
                        onClick={() => openQrModal(qr)}
                      >
                        <Edit3 size={12} /> {t('profile.edit')}
                      </button>
                      <button
                        className="btn btn-soft text-xs text-red-600"
                        onClick={() => setDeletingQr(qr)}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </article>
                ))}
                {qrImages.length === 0 && (
                  <p className="text-sm text-slate-500">
                    {t('profile.qrEmpty')}
                  </p>
                )}
              </div>
            </section>
          )}

          <section className="panel p-6">
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
          </section>
        </div>
      </div>

      <Modal
        open={qrModalOpen}
        title={t(editingQr ? 'profile.qrEdit' : 'profile.qrAddTitle')}
        onClose={() => setQrModalOpen(false)}
      >
        <div className="space-y-4">
          <label className="block space-y-1">
            <span className="label">{t('profile.qrLabel')}</span>
            <input
              className="field w-full"
              maxLength={80}
              value={qrLabel}
              onChange={(event) => setQrLabel(event.target.value)}
            />
          </label>
          <ImagePicker
            label={t('profile.qrImage')}
            currentUrl={editingQr?.imageUrl}
            maxSizeMb={2}
            onFile={setQrFile}
          />
          <button
            className="btn btn-primary w-full"
            disabled={mediaBusy || !qrLabel.trim() || (!editingQr && !qrFile)}
            onClick={() => void saveQr()}
          >
            {mediaBusy ? t('common.loading') : t('common.save')}
          </button>
        </div>
      </Modal>

      {deletingQr && (
        <ConfirmDialog
          title={t('profile.qrRemove')}
          message={`${deletingQr.label}: ${t('profile.qrRemoveHint')}`}
          pending={mediaBusy}
          onCancel={() => setDeletingQr(null)}
          onConfirm={() => void removeQr()}
        />
      )}
    </div>
  );
}
