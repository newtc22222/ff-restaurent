import type { FastifyInstance } from 'fastify';
import { requireAuthenticatedUser } from '../http/auth-guards.js';
import { prisma } from '../prisma.js';

/**
 * Notification routes are user-scoped: each user only reads their own reminders.
 */
export const registerNotificationRoutes = (app: FastifyInstance) => {
  app.get(
    '/notifications',
    { preHandler: requireAuthenticatedUser },
    async (request) => {
      return prisma.notification.findMany({
        where: { userId: request.currentUser.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    },
  );

  app.patch(
    '/notifications/:id/read',
    { preHandler: requireAuthenticatedUser },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const notification = await prisma.notification.findFirst({
        where: { id, userId: request.currentUser.id },
      });
      if (!notification) {
        return reply.code(404).send({
          code: 'NOT_FOUND',
          message: 'Notification not found',
        });
      }
      return prisma.notification.update({
        where: { id: notification.id },
        data: { readAt: new Date() },
      });
    },
  );
};
