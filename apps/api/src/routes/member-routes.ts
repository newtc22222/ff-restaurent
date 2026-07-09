import type { FastifyInstance } from 'fastify';
import { ChefRole } from '@prisma/client';
import {
  requireAuthenticatedUser,
  requireHeadChef,
} from '../http/auth-guards.js';
import { prisma } from '../prisma.js';
import { sanitizeUser } from '../roles.js';
import { chefRoleSchema } from '../schemas.js';

/**
 * Member routes keep regular member lookup separate from HEAD_CHEF user admin.
 */
export const registerMemberRoutes = (app: FastifyInstance) => {
  app.get('/members', { preHandler: requireAuthenticatedUser }, async () => {
    const users = await prisma.user.findMany({ orderBy: { name: 'asc' } });
    return users.map(sanitizeUser);
  });

  app.get(
    '/users',
    { preHandler: [requireAuthenticatedUser, requireHeadChef] },
    async () => {
      const users = await prisma.user.findMany({ orderBy: { name: 'asc' } });
      return users.map(sanitizeUser);
    },
  );

  app.patch(
    '/users/:id/chef-role',
    { preHandler: [requireAuthenticatedUser, requireHeadChef] },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = chefRoleSchema.parse(request.body);
      const existing = await prisma.user.findUniqueOrThrow({ where: { id } });
      const updated = await prisma.user.update({
        where: { id },
        data: { chefRole: body.chefRole as ChefRole | null },
      });
      await prisma.roleAuditLog.create({
        data: {
          userId: id,
          changedById: request.currentUser.id,
          fromRole: existing.chefRole,
          toRole: updated.chefRole,
        },
      });
      return sanitizeUser(updated);
    },
  );
};
