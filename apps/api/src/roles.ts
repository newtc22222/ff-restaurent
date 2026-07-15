import { ChefRole, Prisma, SystemRole, User } from '@prisma/client';

export const publicUserSelect = {
  id: true,
  username: true,
  phone: true,
  name: true,
  chefRole: true,
  systemRole: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export type CurrentUser = Pick<
  User,
  'id' | 'username' | 'name' | 'chefRole' | 'systemRole'
>;

export const isRootAdmin = (user: CurrentUser) =>
  user.systemRole === SystemRole.ROOT_ADMIN;

export const isSousChefOrAbove = (user: CurrentUser) =>
  isRootAdmin(user) ||
  user.chefRole === ChefRole.SOUS_CHEF ||
  user.chefRole === ChefRole.HEAD_CHEF;

export const isHeadChef = (user: CurrentUser) =>
  isRootAdmin(user) || user.chefRole === ChefRole.HEAD_CHEF;

export const sanitizeUser = (user: User) => ({
  id: user.id,
  username: user.username,
  phone: user.phone,
  name: user.name,
  chefRole: user.chefRole,
  systemRole: user.systemRole,
  paymentRemindersEnabled: user.paymentRemindersEnabled,
  roles: [
    'CUSTOMER',
    ...(user.chefRole ? [user.chefRole] : []),
    ...(user.systemRole ? [user.systemRole] : []),
  ],
  createdAt: user.createdAt,
});
