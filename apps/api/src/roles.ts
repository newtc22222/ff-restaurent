import { ChefRole, User } from '@prisma/client';

export type CurrentUser = Pick<User, 'id' | 'username' | 'name' | 'chefRole'>;

export const isSousChefOrAbove = (user: CurrentUser) =>
  user.chefRole === ChefRole.SOUS_CHEF || user.chefRole === ChefRole.HEAD_CHEF;

export const isHeadChef = (user: CurrentUser) =>
  user.chefRole === ChefRole.HEAD_CHEF;

export const sanitizeUser = (user: User) => ({
  id: user.id,
  username: user.username,
  phone: user.phone,
  name: user.name,
  chefRole: user.chefRole,
  roles: ['CUSTOMER', ...(user.chefRole ? [user.chefRole] : [])],
  createdAt: user.createdAt,
});
