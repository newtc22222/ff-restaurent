import { Prisma, User } from '@prisma/client';

import {
  isHeadChef as isHeadChefShared,
  isRootAdmin as isRootAdminShared,
  isSousChefOrAbove as isSousChefOrAboveShared,
} from '@ff-restaurent/shared';

export const publicUserSelect = {
  id: true,
  username: true,
  phone: true,
  name: true,
  avatarUrl: true,
  chefRole: true,
  systemRole: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export type CurrentUser = Pick<
  User,
  'id' | 'username' | 'name' | 'chefRole' | 'systemRole'
>;

/*
 * The hierarchy is defined once in @ff-restaurent/shared and re-exported here
 * so the web cannot drift from the API's permission semantics. This module
 * keeps the Prisma-specific selects and contracts below.
 */
export const isRootAdmin = (user: CurrentUser) => isRootAdminShared(user);

export const isSousChefOrAbove = (user: CurrentUser) =>
  isSousChefOrAboveShared(user);

export const isHeadChef = (user: CurrentUser) => isHeadChefShared(user);

export const sanitizeUser = (user: User) => ({
  id: user.id,
  username: user.username,
  phone: user.phone,
  name: user.name,
  avatarUrl: user.avatarUrl,
  chefRole: user.chefRole,
  systemRole: user.systemRole,
  paymentRemindersEnabled: user.paymentRemindersEnabled,
  accountStatus: user.accountStatus,
  roles: [
    'CUSTOMER',
    ...(user.chefRole ? [user.chefRole] : []),
    ...(user.systemRole ? [user.systemRole] : []),
  ],
  createdAt: user.createdAt,
});
