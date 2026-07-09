import { Users } from 'lucide-react';
import type { ApiClient, ChefRole, User } from '../../api.js';
import { roleLabel } from '../../utils/helpers.js';
import SectionTitle from '../ui/SectionTitle.js';
import EmptyState from '../ui/EmptyState.js';

interface AdminViewProps {
  /**
   * The API client instance.
   */
  api: ApiClient;
  /**
   * List of all users/members.
   */
  users: User[];
  /**
   * Function to refresh application data.
   */
  refresh: () => Promise<void>;
  /**
   * Function to update global error state.
   */
  setError: (error: string | null) => void;
  /**
   * Translation utility function.
   */
  t: (key: string) => string;
}

/**
 * AdminView lists all workspace members and allows a Head Chef to update their system roles.
 */
export default function AdminView({
  api,
  users,
  refresh,
  setError,
  t,
}: AdminViewProps) {
  const updateRole = async (id: string, chefRole: ChefRole) => {
    setError(null);
    try {
      await api.request(`/users/${id}/chef-role`, {
        method: 'PATCH',
        body: JSON.stringify({ chefRole }),
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update user role');
    }
  };

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
