import {
  isHeadChef,
  isRootAdmin as isRootAdminShared,
  isSousChefOrAbove,
} from '@ff-restaurent/shared';

import type { Bill, User } from '@/api/types';

export const roleLabel = (
  user?: User | null,
  t?: (key: string) => string,
): string => {
  if (!user) return t?.('role.customer') ?? 'Customer';
  if (user.systemRole === 'ROOT_ADMIN')
    return t?.('role.rootadmin') ?? 'Root Admin';
  if (user.chefRole === 'HEAD_CHEF') return t?.('role.headchef') ?? 'Head Chef';
  if (user.chefRole === 'SOUS_CHEF') return t?.('role.souschef') ?? 'Sous chef';
  return t?.('role.customer') ?? 'Customer';
};

export const canChef = (user: User | null): boolean => isSousChefOrAbove(user);

export const isHead = (user: User | null): boolean => isHeadChef(user);

export const isRootAdmin = (user: User | null): boolean =>
  isRootAdminShared(user);

export const canManageBill = (bill: Bill, user: User): boolean =>
  isHead(user) || bill.createdById === user.id;
