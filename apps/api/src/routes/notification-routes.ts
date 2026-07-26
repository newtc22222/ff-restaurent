import type { FastifyInstance } from 'fastify';

import { requireAuthenticatedUser } from '../http/auth-guards.js';
import { prisma } from '../lib/prisma.js';
import {
  notificationPreferenceSchema,
  pushSubscriptionSchema,
} from '../schemas/index.js';

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
    '/notifications/read-all',
    { preHandler: requireAuthenticatedUser },
    async (request) => {
      const readAt = new Date();
      const result = await prisma.notification.updateMany({
        where: { userId: request.currentUser.id, readAt: null },
        data: { readAt },
      });
      return { updated: result.count, readAt };
    },
  );

  app.get(
    '/me/notification-preferences',
    { preHandler: requireAuthenticatedUser },
    async (request) =>
      prisma.user.findUniqueOrThrow({
        where: { id: request.currentUser.id },
        select: { paymentRemindersEnabled: true },
      }),
  );

  app.patch(
    '/me/notification-preferences',
    { preHandler: requireAuthenticatedUser },
    async (request) => {
      const body = notificationPreferenceSchema.parse(request.body);
      return prisma.user.update({
        where: { id: request.currentUser.id },
        data: body,
        select: { paymentRemindersEnabled: true },
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

  app.post(
    '/me/push-subscriptions',
    { preHandler: requireAuthenticatedUser },
    async (request) => {
      const body = pushSubscriptionSchema.parse(request.body);
      return prisma.pushSubscription.upsert({
        where: { fcmToken: body.fcmToken },
        create: { userId: request.currentUser.id, fcmToken: body.fcmToken },
        update: { userId: request.currentUser.id, lastSeenAt: new Date() },
        select: { id: true },
      });
    },
  );

  app.delete(
    '/me/push-subscriptions/:id',
    { preHandler: requireAuthenticatedUser },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const subscription = await prisma.pushSubscription.findFirst({
        where: { id, userId: request.currentUser.id },
      });
      if (!subscription) {
        return reply.code(404).send({
          code: 'NOT_FOUND',
          message: 'Push subscription not found',
        });
      }
      await prisma.pushSubscription.delete({ where: { id: subscription.id } });
      return reply.code(204).send();
    },
  );
};
