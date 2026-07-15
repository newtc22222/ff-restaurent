import { Users } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router';
import type { ChefRole } from '../lib/api';
import { isRootAdmin, roleLabel } from '../lib/helpers';
import { useAppContext } from '../app/providers/app-context';
import { useI18n } from '../app/providers/i18n';
import { useMutation } from '../hooks/useMutation';
import SectionTitle from '../components/ui/SectionTitle';
import EmptyState from '../components/ui/EmptyState';
import Dropdown from '../components/ui/Dropdown';

/**
 * AdminPage is the ROOT_ADMIN-only role governance and ownership-transfer UI.
 */
export default function AdminPage() {
  const { user, users } = useAppContext();
  const { t } = useI18n();
  const { mutate } = useMutation();
  const [targetUsername, setTargetUsername] = useState('');
  const [confirmationUsername, setConfirmationUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');

  if (!isRootAdmin(user)) return <Navigate to="/bills" replace />;

  const updateRole = (id: string, chefRole: ChefRole) =>
    mutate(
      { intent: 'update-role', userId: id, chefRole },
      {
        fallback: t('toast.roleUpdateFailed'),
        success: t('toast.roleUpdated'),
      },
    );

  const transferRoot = (event: FormEvent) => {
    event.preventDefault();
    void mutate(
      {
        intent: 'root-transfer',
        payload: {
          targetUsername,
          confirmationUsername,
          currentPassword,
        },
      },
      {
        fallback: t('toast.rootTransferFailed'),
        success: t('toast.rootTransferred'),
        redirects: true,
      },
    );
  };

  const transferTargets = users.filter(
    (member) => member.id !== user.id && member.systemRole !== 'ROOT_ADMIN',
  );

  return (
    <div className="space-y-4">
      <SectionTitle title={t('admin.title')} subtitle={t('admin.subtitle')} />
      {users.length === 0 && (
        <EmptyState
          icon={Users}
          title={t('admin.noMembers')}
          description={t('admin.noMembersDesc')}
          steps={[]}
        />
      )}
      {users.map((member) => (
        <article
          key={member.id}
          className="panel flex flex-wrap items-center justify-between gap-3 p-4"
        >
          <div>
            <h3 className="font-bold">{member.name}</h3>
            <p className="text-sm text-slate-500">
              @{member.username} / {roleLabel(member, t)}
            </p>
          </div>
          {member.id !== user.id && (
            <div style={{ minWidth: 160 }}>
              <Dropdown
                label={t('admin.customerOnly')}
                ariaLabel={`${member.name} role`}
                value={member.chefRole ?? ''}
                onChange={(role) =>
                  updateRole(member.id, (role || null) as ChefRole)
                }
                options={[
                  { value: '', label: t('admin.customerOnly') },
                  { value: 'SOUS_CHEF', label: t('role.souschef') },
                  { value: 'HEAD_CHEF', label: t('role.headchef') },
                ]}
                menuAlign="right"
              />
            </div>
          )}
        </article>
      ))}

      <section className="panel p-4 sm:p-6">
        <h2 className="text-lg font-bold text-ink">
          {t('admin.transferTitle')}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {t('admin.transferDescription')}
        </p>
        <form
          className="mt-5 grid gap-4 md:grid-cols-2"
          onSubmit={transferRoot}
        >
          <label className="block space-y-2">
            <span className="label">{t('admin.transferTarget')}</span>
            <Dropdown
              label={t('admin.chooseMember')}
              ariaLabel={t('admin.transferTarget')}
              value={targetUsername}
              onChange={setTargetUsername}
              options={transferTargets.map((member) => ({
                value: member.username,
                label: member.name,
                description: `@${member.username} / ${roleLabel(member, t)}`,
                searchText: `${member.name} ${member.username}`,
              }))}
              searchable
              searchPlaceholder={t('bills.searchMembers')}
              emptyMessage={t('admin.noTransferTargets')}
            />
          </label>
          <label className="block space-y-2">
            <span className="label">{t('admin.confirmTargetUsername')}</span>
            <input
              className="field w-full"
              aria-label={t('admin.confirmTargetUsername')}
              value={confirmationUsername}
              onChange={(event) => setConfirmationUsername(event.target.value)}
              autoComplete="off"
              required
            />
          </label>
          <label className="block space-y-2 md:col-span-2">
            <span className="label">{t('admin.currentPassword')}</span>
            <input
              className="field w-full"
              type="password"
              aria-label={t('admin.currentPassword')}
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <button
            className="btn btn-primary md:col-span-2 md:justify-self-start"
            disabled={
              !targetUsername ||
              confirmationUsername !== targetUsername ||
              !currentPassword
            }
          >
            {t('admin.transferAction')}
          </button>
        </form>
      </section>
    </div>
  );
}
