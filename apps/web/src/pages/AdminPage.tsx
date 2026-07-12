import { Users } from 'lucide-react';
import { Navigate } from 'react-router';
import type { ChefRole } from '../lib/api.js';
import { isHead, roleLabel } from '../lib/helpers.js';
import { useAppContext } from '../app/providers/app-context.js';
import { useI18n } from '../app/providers/i18n.js';
import { useMutation } from '../hooks/useMutation.js';
import SectionTitle from '../components/ui/SectionTitle.js';
import EmptyState from '../components/ui/EmptyState.js';

/**
 * AdminPage lists all workspace members and allows a Head Chef to update their system roles.
 */
export default function AdminPage() {
  const { user, users, setError } = useAppContext();
  const { t } = useI18n();
  const { mutate } = useMutation(setError);

  if (!isHead(user)) return <Navigate to="/bills" replace />;

  const updateRole = (id: string, chefRole: ChefRole) =>
    mutate(
      { intent: 'update-role', userId: id, chefRole },
      { fallback: 'Could not update user role' },
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
          <select
            className="field"
            value={member.chefRole ?? ''}
            onChange={(event) =>
              updateRole(member.id, (event.target.value || null) as ChefRole)
            }
          >
            <option value="">{t('admin.customerOnly')}</option>
            <option value="SOUS_CHEF">{t('role.souschef')}</option>
            <option value="HEAD_CHEF">{t('role.headchef')}</option>
          </select>
        </article>
      ))}
    </div>
  );
}
