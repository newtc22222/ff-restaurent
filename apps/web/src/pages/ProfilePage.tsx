import { FormEvent, useState } from 'react';
import { Edit3 } from 'lucide-react';
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
  const { mutate } = useMutation();

  const onBack = () => navigate('/bills');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void mutate(
      {
        intent: 'update-profile',
        payload: {
          name: form.name,
          username: form.username,
          ...(form.phone ? { phone: form.phone } : {}),
        },
      },
      {
        fallback: t('toast.profileUpdateFailed'),
        success: t('toast.profileUpdated'),
        onSuccess: () => setEditing(false),
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
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                className="btn btn-soft flex-1"
                onClick={() => setEditing(false)}
              >
                {t('auth.cancel')}
              </button>
              <button className="btn btn-primary flex-1">
                {t('profile.save')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
