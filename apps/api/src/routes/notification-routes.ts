import { NotificationLocale } from '@prisma/client';
import type { FastifyInstance } from 'fastify';

import { requireAuthenticatedUser } from '../http/auth-guards.js';
import { prisma } from '../lib/prisma.js';
import {
  notificationPreferenceSchema,
  pushSubscriptionSchema,
} from '../schemas/index.js';
import { PRODUCT_NOTIFICATION_CATEGORIES } from '../services/notification-service.js';

const getNotificationPreferences = async (userId: string) => {
  const [user, overrides, subscriptions] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { paymentRemindersEnabled: true },
    }),
    prisma.notificationPreference.findMany({
      where: { userId, category: { in: [...PRODUCT_NOTIFICATION_CATEGORIES] } },
      select: { category: true, inAppEnabled: true, pushEnabled: true },
    }),
    prisma.pushSubscription.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
      select: { id: true, locale: true },
    }),
  ]);
  const overrideByCategory = new Map(
    overrides.map((preference) => [preference.category, preference]),
  );
  return {
    paymentRemindersEnabled: user.paymentRemindersEnabled,
    categories: PRODUCT_NOTIFICATION_CATEGORIES.map((category) => ({
      category,
      inAppEnabled: overrideByCategory.get(category)?.inAppEnabled ?? true,
      pushEnabled: overrideByCategory.get(category)?.pushEnabled ?? false,
    })),
    pushSubscriptions: subscriptions.map((subscription) => ({
      id: subscription.id,
      locale: subscription.locale.toLowerCase(),
    })),
  };
};

/**
 * Notification routes are user-scoped: each user only reads their own reminders.
 */
export const registerNotificationRoutes = (app: FastifyInstance) => {
  app.get(
    '/notifications',
    { preHandler: requireAuthenticatedUser },
    async (request) => {
      return prisma.notification.findMany({
        where: { userId: request.currentUser.id, inAppVisible: true },
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
        where: {
          userId: request.currentUser.id,
          inAppVisible: true,
          readAt: null,
        },
        data: { readAt },
      });
      return { updated: result.count, readAt };
    },
  );

  app.get(
    '/me/notification-preferences',
    { preHandler: requireAuthenticatedUser },
    async (request) => getNotificationPreferences(request.currentUser.id),
  );

  app.patch(
    '/me/notification-preferences',
    { preHandler: requireAuthenticatedUser },
    async (request) => {
      const body = notificationPreferenceSchema.parse(request.body);
      await prisma.$transaction(async (tx) => {
        if (body.paymentRemindersEnabled !== undefined) {
          await tx.user.update({
            where: { id: request.currentUser.id },
            data: {
              paymentRemindersEnabled: body.paymentRemindersEnabled,
            },
          });
        }
        for (const preference of body.categories ?? []) {
          await tx.notificationPreference.upsert({
            where: {
              userId_category: {
                userId: request.currentUser.id,
                category: preference.category,
              },
            },
            create: { userId: request.currentUser.id, ...preference },
            update: {
              inAppEnabled: preference.inAppEnabled,
              pushEnabled: preference.pushEnabled,
            },
          });
        }
      });
      return getNotificationPreferences(request.currentUser.id);
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
        create: {
          userId: request.currentUser.id,
          fcmToken: body.fcmToken,
          locale:
            body.locale === 'en'
              ? NotificationLocale.EN
              : NotificationLocale.VI,
        },
        update: {
          userId: request.currentUser.id,
          locale:
            body.locale === 'en'
              ? NotificationLocale.EN
              : NotificationLocale.VI,
          lastSeenAt: new Date(),
        },
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
