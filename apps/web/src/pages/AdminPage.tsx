import { Users } from 'lucide-react';
import { Navigate } from 'react-router';
import type { ChefRole } from '../lib/api';
import { isHead, roleLabel } from '../lib/helpers';
import { useAppContext } from '../app/providers/app-context';
import { useI18n } from '../app/providers/i18n';
import { useMutation } from '../hooks/useMutation';
import SectionTitle from '../components/ui/SectionTitle';
import EmptyState from '../components/ui/EmptyState';
import Dropdown from '../components/ui/Dropdown';

/**
 * AdminPage lists all workspace members and allows a Head Chef to update their system roles.
 */
export default function AdminPage() {
  const { user, users } = useAppContext();
  const { t } = useI18n();
  const { mutate } = useMutation();

  if (!isHead(user)) return <Navigate to="/bills" replace />;

  const updateRole = (id: string, chefRole: ChefRole) =>
    mutate(
      { intent: 'update-role', userId: id, chefRole },
      {
        fallback: t('toast.roleUpdateFailed'),
        success: t('toast.roleUpdated'),
      },
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
    </div>
  );
}
