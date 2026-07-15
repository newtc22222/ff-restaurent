import type { FastifyInstance } from 'fastify';
import { ChefRole, SystemRole } from '@prisma/client';
import {
  requireAuthenticatedUser,
  requireRootAdmin,
} from '../http/auth-guards.js';
import { prisma } from '../prisma.js';
import { transferRootAdmin } from '../root-admin-service.js';
import { sanitizeUser } from '../roles.js';
import { chefRoleSchema, rootAdminTransferSchema } from '../schemas.js';
import { memberQuerySchema } from '../schemas.js';
import { normalizeSearchQuery } from '../search-normalization.js';
import { pageResult } from '../pagination.js';

const listMembers = async (queryValue: unknown) => {
  const query = memberQuerySchema.parse(queryValue);
  const orderBy =
    query.sort === 'name-desc'
      ? [{ name: 'desc' as const }, { id: 'desc' as const }]
      : query.sort === 'created-desc'
        ? [{ createdAt: 'desc' as const }, { id: 'desc' as const }]
        : [{ name: 'asc' as const }, { id: 'asc' as const }];
  const users = await prisma.user.findMany({
    where: query.search
      ? { searchText: { contains: normalizeSearchQuery(query.search) } }
      : undefined,
    orderBy,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    take: query.limit + 1,
  });
  return pageResult(users.map(sanitizeUser), query.limit);
};

/**
 * Member routes keep regular member lookup separate from ROOT_ADMIN governance.
 */
export const registerMemberRoutes = (app: FastifyInstance) => {
  app.get(
    '/members',
    { preHandler: requireAuthenticatedUser },
    async (request) => listMembers(request.query),
  );

  app.get(
    '/users',
    { preHandler: [requireAuthenticatedUser, requireRootAdmin] },
    async (request) => listMembers(request.query),
  );

  app.patch(
    '/users/:id/chef-role',
    { preHandler: [requireAuthenticatedUser, requireRootAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = chefRoleSchema.parse(request.body);
      const target = await prisma.user.findUnique({ where: { id } });
      if (!target) {
        return reply
          .code(404)
          .send({ code: 'NOT_FOUND', message: 'User not found' });
      }
      if (target.systemRole === SystemRole.ROOT_ADMIN) {
        return reply.code(403).send({
          code: 'ROOT_ADMIN_ROLE_CHANGE_FORBIDDEN',
          message: 'The ROOT_ADMIN cannot be changed through this endpoint',
        });
      }
      const updated = await prisma.$transaction(async (tx) => {
        const existing = await tx.user.findUniqueOrThrow({ where: { id } });
        const changedCount = await tx.user.updateMany({
          where: { id, systemRole: null },
          data: { chefRole: body.chefRole as ChefRole | null },
        });
        if (changedCount.count !== 1) return null;
        const changed = await tx.user.findUniqueOrThrow({ where: { id } });
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
        return reply.code(403).send({
          code: 'ROOT_ADMIN_ROLE_CHANGE_FORBIDDEN',
          message: 'The ROOT_ADMIN cannot be changed through this endpoint',
        });
      }
      return sanitizeUser(updated);
    },
  );

  app.post(
    '/admin/root-transfer',
    { preHandler: [requireAuthenticatedUser, requireRootAdmin] },
    async (request) => {
      const body = rootAdminTransferSchema.parse(request.body);
      const result = await transferRootAdmin({
        currentUserId: request.currentUser.id,
        ...body,
      });
      request.log.warn({
        event: 'root_admin_transferred',
        fromUserId: request.currentUser.id,
        toUserId: result.targetUserId,
        auditId: result.auditId,
      });
      return { ok: true };
    },
  );
};
