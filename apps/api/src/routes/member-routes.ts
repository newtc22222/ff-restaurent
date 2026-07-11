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
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = chefRoleSchema.parse(request.body);
      if (id === request.currentUser.id) {
        return reply.code(403).send({
          code: 'SELF_ROLE_CHANGE_FORBIDDEN',
          message: 'Administrators cannot change their own role',
        });
      }
      const updated = await prisma.$transaction(async (tx) => {
        const existing = await tx.user.findUniqueOrThrow({ where: { id } });
        if (
          existing.chefRole === ChefRole.HEAD_CHEF &&
          body.chefRole !== ChefRole.HEAD_CHEF
        ) {
          const headChefCount = await tx.user.count({
            where: { chefRole: ChefRole.HEAD_CHEF },
          });
          if (headChefCount <= 1) {
            return null;
          }
        }
        const changed = await tx.user.update({
          where: { id },
          data: { chefRole: body.chefRole as ChefRole | null },
        });
        await tx.roleAuditLog.create({
          data: {
            userId: id,
            changedById: request.currentUser.id,
            fromRole: existing.chefRole,
            toRole: changed.chefRole,
          },
        });
        return changed;
      });
      if (!updated) {
        return reply.code(409).send({
          code: 'FINAL_HEAD_CHEF_REQUIRED',
          message: 'The final Head Chef cannot be demoted',
        });
      }
      return sanitizeUser(updated);
    },
  );
};
