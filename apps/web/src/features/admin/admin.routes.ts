import toast from 'react-hot-toast';
import { redirect, type LoaderFunctionArgs } from 'react-router';
import type { CatalogPage, User } from '@/api/types';
import { session } from '@/lib/session';
import { isRootAdmin } from '@/lib/permissions';
import { forwardListQuery } from '@/app/route-helpers';
import { roleGuard } from '@/app/root.routes';
import type { IntentMap } from '@/app/mutation-types';

export async function membersLoader(args: LoaderFunctionArgs) {
  await roleGuard(isRootAdmin, args);
  const query = forwardListQuery(
    args.request,
    new Set(['cursor', 'direction', 'limit', 'sort', 'search']),
  );
  return session.api().request<CatalogPage<User>>(`/users?${query}`);
}

export const adminIntents = {
  'update-role': ({ api, body }) =>
    api.request(`/users/${body.userId}/chef-role`, {
      method: 'PATCH',
      body: JSON.stringify({ chefRole: body.chefRole }),
    }),
  'root-transfer': async ({ api, body }) => {
    await api.request('/admin/root-transfer', {
      method: 'POST',
      body: JSON.stringify(body.payload),
    });
    session.clear();
    if (typeof body.toastSuccess === 'string') toast.success(body.toastSuccess);
    return redirect('/login');
  },
  'issue-password-reset': ({ api, body }) =>
    api.request(`/admin/password-reset-requests/${body.requestId}/issue`, {
      method: 'POST',
    }),
  'reject-password-reset': ({ api, body }) =>
    api.request(`/admin/password-reset-requests/${body.requestId}/reject`, {
      method: 'POST',
    }),
} satisfies IntentMap;
