import type { IntentMap } from '@/app/mutation-types';

export const notificationIntents = {
  'read-notification': ({ api, body }) =>
    api.request(`/notifications/${body.notificationId}/read`, {
      method: 'PATCH',
    }),
  'read-all-notifications': ({ api }) =>
    api.request('/notifications/read-all', { method: 'PATCH' }),
} satisfies IntentMap;
