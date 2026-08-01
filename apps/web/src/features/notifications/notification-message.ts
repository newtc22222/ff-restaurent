import type { Notification } from '@/api/types';

const stringValue = (value: unknown) =>
  typeof value === 'string' ? value : null;

const interpolate = (
  template: string,
  values: Record<string, string | number>,
) =>
  Object.entries(values).reduce(
    (message, [key, value]) => message.replaceAll(`{{${key}}}`, String(value)),
    template,
  );

export const notificationMessage = (
  notification: Notification,
  t: (key: string) => string,
) => {
  const data = notification.data ?? {};
  const actorName = stringValue(data.actorName);
  if (
    notification.category === 'RESTAURANT_CREATED' &&
    actorName &&
    stringValue(data.restaurantName)
  ) {
    return interpolate(t('notifications.restaurantCreated'), {
      actorName,
      restaurantName: stringValue(data.restaurantName)!,
    });
  }
  if (
    notification.category === 'COLLECTION_PUBLISHED' &&
    actorName &&
    stringValue(data.collectionName)
  ) {
    return interpolate(t('notifications.collectionPublished'), {
      actorName,
      collectionName: stringValue(data.collectionName)!,
    });
  }
  if (
    notification.category === 'PAYMENT_REMINDER' &&
    stringValue(data.restaurantName) &&
    typeof data.finalPrice === 'number'
  ) {
    return interpolate(t('notifications.paymentReminder'), {
      restaurantName: stringValue(data.restaurantName)!,
      finalPrice: data.finalPrice,
    });
  }
  return notification.message;
};

export const notificationTarget = (notification: Notification) => {
  if (
    notification.targetUrl?.startsWith('/') &&
    !notification.targetUrl.startsWith('//')
  ) {
    return notification.targetUrl;
  }
  return notification.billId ? `/bills/${notification.billId}` : null;
};
