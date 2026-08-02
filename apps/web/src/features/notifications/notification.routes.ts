import type { Notification } from '@/api/types';
import type { IntentMap } from '@/app/mutation-types';
import { getActiveQueryClient } from '@/app/providers/query';

import { notificationQueryKeys } from './notification.queries';

const updateNotificationQueries = (
  update: (notifications: Notification[]) => Notification[],
) =>
  getActiveQueryClient()?.setQueriesData<Notification[]>(
    { queryKey: notificationQueryKeys.all },
    (notifications) => (notifications ? update(notifications) : notifications),
  );

export const notificationIntents = {
  'read-notification': async ({ api, body }) => {
    const notification = await api.request<Notification>(
      `/notifications/${body.notificationId}/read`,
      {
        method: 'PATCH',
      },
    );
    updateNotificationQueries((notifications) =>
      notifications.map((current) =>
        current.id === notification.id ? notification : current,
      ),
    );
    return notification;
  },
  'read-all-notifications': async ({ api }) => {
    const result = await api.request<{ updated: number; readAt: string }>(
      '/notifications/read-all',
      { method: 'PATCH' },
    );
    updateNotificationQueries((notifications) =>
      notifications.map((notification) =>
        notification.readAt
          ? notification
          : { ...notification, readAt: result.readAt },
      ),
    );
    return result;
  },
} satisfies IntentMap;
