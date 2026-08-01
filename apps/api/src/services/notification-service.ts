import {
  NotificationCategory,
  NotificationDeliveryStatus,
  NotificationLocale,
  Prisma,
  UserAccountStatus,
} from '@prisma/client';

import { prisma } from '../lib/prisma.js';
import { sendReminderPush } from './push-messaging.js';

export const PRODUCT_NOTIFICATION_CATEGORIES = [
  NotificationCategory.RESTAURANT_CREATED,
  NotificationCategory.COLLECTION_PUBLISHED,
] as const;

type ProductNotificationCategory =
  (typeof PRODUCT_NOTIFICATION_CATEGORIES)[number];
type PushLogger = { warn: (...args: unknown[]) => void };
type ProductNotificationData = Record<string, string>;
type ProductNotificationEvent = {
  category: ProductNotificationCategory;
  actorId: string;
  actorName: string;
  targetUrl: string;
  deduplicationKey: string;
  data: ProductNotificationData;
  fallbackMessage: string;
};
type NotificationPreference = {
  userId: string;
  inAppEnabled: boolean;
  pushEnabled: boolean;
};
type PushSubscription = {
  userId: string;
  fcmToken: string;
  locale: NotificationLocale;
};
type NotificationCreateInput = {
  userId: string;
  category: ProductNotificationCategory;
  targetUrl: string;
  actorId: string;
  deduplicationKey: string;
  data: ProductNotificationData;
  message: string;
  inAppVisible: boolean;
  pushStatus: NotificationDeliveryStatus;
};
type PublisherDependencies = {
  findAudience: (actorId: string) => Promise<string[]>;
  findPreferences: (
    userIds: string[],
    category: ProductNotificationCategory,
  ) => Promise<NotificationPreference[]>;
  createNotifications: (items: NotificationCreateInput[]) => Promise<string[]>;
  findSubscriptions: (userIds: string[]) => Promise<PushSubscription[]>;
  updateDelivery: (
    userIds: string[],
    deduplicationKey: string,
    status: NotificationDeliveryStatus,
  ) => Promise<void>;
  send: typeof sendReminderPush;
};

export const isSafeNotificationTarget = (targetUrl: string) =>
  targetUrl.startsWith('/') && !targetUrl.startsWith('//');

export const productNotificationCopy = (
  category: ProductNotificationCategory,
  locale: NotificationLocale,
  data: ProductNotificationData,
): { title: string; body: string } => {
  const actorName = data.actorName ?? '';
  if (category === NotificationCategory.RESTAURANT_CREATED) {
    const restaurantName = data.restaurantName ?? '';
    return locale === NotificationLocale.VI
      ? {
          title: 'Quán ăn mới',
          body: `${actorName} đã thêm ${restaurantName}.`,
        }
      : {
          title: 'New restaurant',
          body: `${actorName} added ${restaurantName}.`,
        };
  }
  const collectionName = data.collectionName ?? '';
  return locale === NotificationLocale.VI
    ? {
        title: 'Bộ sưu tập công khai mới',
        body: `${actorName} đã công khai ${collectionName}.`,
      }
    : {
        title: 'New public collection',
        body: `${actorName} published ${collectionName}.`,
      };
};

const publisherDependencies: PublisherDependencies = {
  findAudience: async (actorId) =>
    (
      await prisma.user.findMany({
        where: {
          id: { not: actorId },
          accountStatus: UserAccountStatus.ACTIVE,
        },
        select: { id: true },
      })
    ).map(({ id }) => id),
  findPreferences: (userIds, category) =>
    prisma.notificationPreference.findMany({
      where: { userId: { in: userIds }, category },
      select: { userId: true, inAppEnabled: true, pushEnabled: true },
    }),
  createNotifications: async (items) => {
    const result = await prisma.notification.createManyAndReturn({
      data: items.map((item) => ({
        ...item,
        data: item.data as Prisma.InputJsonValue,
      })),
      skipDuplicates: true,
      select: { userId: true },
    });
    return result.map(({ userId }) => userId);
  },
  findSubscriptions: (userIds) =>
    prisma.pushSubscription.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, fcmToken: true, locale: true },
    }),
  updateDelivery: async (userIds, deduplicationKey, status) => {
    const attemptedAt = new Date();
    await prisma.notification.updateMany({
      where: { userId: { in: userIds }, deduplicationKey },
      data: {
        pushStatus: status,
        pushAttemptedAt: attemptedAt,
        pushSentAt:
          status === NotificationDeliveryStatus.SENT ? attemptedAt : null,
      },
    });
  },
  send: sendReminderPush,
};

export const publishProductEvent = async (
  event: ProductNotificationEvent,
  logger: PushLogger,
  dependencies: PublisherDependencies = publisherDependencies,
): Promise<{ created: number; pushed: number }> => {
  try {
    if (!isSafeNotificationTarget(event.targetUrl)) {
      throw new Error('Unsafe notification target');
    }
    const audience = (await dependencies.findAudience(event.actorId)).filter(
      (userId) => userId !== event.actorId,
    );
    const preferences = await dependencies.findPreferences(
      audience,
      event.category,
    );
    const preferenceByUser = new Map(
      preferences.map((preference) => [preference.userId, preference]),
    );
    const recipients = audience
      .map((userId) => ({
        userId,
        inAppEnabled: preferenceByUser.get(userId)?.inAppEnabled ?? true,
        pushEnabled: preferenceByUser.get(userId)?.pushEnabled ?? false,
      }))
      .filter(
        (preference) => preference.inAppEnabled || preference.pushEnabled,
      );
    const createdUserIds = await dependencies.createNotifications(
      recipients.map((recipient) => ({
        userId: recipient.userId,
        category: event.category,
        targetUrl: event.targetUrl,
        actorId: event.actorId,
        deduplicationKey: event.deduplicationKey,
        data: event.data,
        message: event.fallbackMessage,
        inAppVisible: recipient.inAppEnabled,
        pushStatus: recipient.pushEnabled
          ? NotificationDeliveryStatus.PENDING
          : NotificationDeliveryStatus.NOT_REQUESTED,
      })),
    );
    const createdUsers = new Set(createdUserIds);
    const pushUserIds = recipients
      .filter(
        (recipient) =>
          recipient.pushEnabled && createdUsers.has(recipient.userId),
      )
      .map((recipient) => recipient.userId);
    if (pushUserIds.length === 0) {
      return { created: createdUserIds.length, pushed: 0 };
    }

    const subscriptions = await dependencies.findSubscriptions(pushUserIds);
    const subscribedUsers = new Set(
      subscriptions.map((subscription) => subscription.userId),
    );
    const skippedUsers = pushUserIds.filter(
      (userId) => !subscribedUsers.has(userId),
    );
    if (skippedUsers.length > 0) {
      await dependencies.updateDelivery(
        skippedUsers,
        event.deduplicationKey,
        NotificationDeliveryStatus.SKIPPED,
      );
    }

    let pushed = 0;
    for (const locale of [NotificationLocale.VI, NotificationLocale.EN]) {
      const localized = subscriptions.filter(
        (subscription) => subscription.locale === locale,
      );
      if (localized.length === 0) continue;
      const copy = productNotificationCopy(event.category, locale, event.data);
      const result = await dependencies.send(
        localized.map((subscription) => subscription.fcmToken),
        { ...copy, url: event.targetUrl },
        logger,
      );
      pushed += result.sent;
      await dependencies.updateDelivery(
        [...new Set(localized.map((subscription) => subscription.userId))],
        event.deduplicationKey,
        result.sent > 0
          ? NotificationDeliveryStatus.SENT
          : NotificationDeliveryStatus.SKIPPED,
      );
    }
    return { created: createdUserIds.length, pushed };
  } catch (error) {
    logger.warn(
      { err: error, event: 'product_notification_publish_failed' },
      'Product notification publish failed',
    );
    return { created: 0, pushed: 0 };
  }
};

export const deliverPaymentReminderPush = async (
  userIds: string[],
  restaurantName: string,
  targetUrl: string,
  deduplicationKey: string,
  logger: PushLogger,
): Promise<void> => {
  try {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, fcmToken: true, locale: true },
    });
    const subscribedUsers = new Set(
      subscriptions.map((subscription) => subscription.userId),
    );
    const skippedUsers = userIds.filter(
      (userId) => !subscribedUsers.has(userId),
    );
    if (skippedUsers.length > 0) {
      await publisherDependencies.updateDelivery(
        skippedUsers,
        deduplicationKey,
        NotificationDeliveryStatus.SKIPPED,
      );
    }
    for (const locale of [NotificationLocale.VI, NotificationLocale.EN]) {
      const localized = subscriptions.filter(
        (subscription) => subscription.locale === locale,
      );
      if (localized.length === 0) continue;
      const result = await sendReminderPush(
        localized.map((subscription) => subscription.fcmToken),
        locale === NotificationLocale.VI
          ? {
              title: 'Nhắc thanh toán',
              body: `Nhắc thanh toán cho ${restaurantName}.`,
              url: targetUrl,
            }
          : {
              title: 'Payment reminder',
              body: `Payment reminder for ${restaurantName}.`,
              url: targetUrl,
            },
        logger,
      );
      await publisherDependencies.updateDelivery(
        [...new Set(localized.map((subscription) => subscription.userId))],
        deduplicationKey,
        result.sent > 0
          ? NotificationDeliveryStatus.SENT
          : NotificationDeliveryStatus.SKIPPED,
      );
    }
  } catch (error) {
    logger.warn(
      { err: error, event: 'payment_reminder_push_failed' },
      'Payment reminder push failed',
    );
  }
};
