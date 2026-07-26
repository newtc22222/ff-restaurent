import type { IntentMap } from '@/app/mutation-types';
import { session } from '@/lib/session';

export const profileIntents = {
  'update-profile': ({ api, body }) =>
    api.request('/me/profile', {
      method: 'PUT',
      body: JSON.stringify(body.payload),
    }),
  'change-password': async ({ api, body }) => {
    const result = await api.request<{ token: string }>('/me/password', {
      method: 'PATCH',
      body: JSON.stringify(body.payload),
    });
    session.setToken(result.token);
    return { ok: true };
  },
  'notification-preferences': ({ api, body }) =>
    api.request('/me/notification-preferences', {
      method: 'PATCH',
      body: JSON.stringify(body.payload),
    }),
  'push-subscribe': ({ api, body }) =>
    api.request('/me/push-subscriptions', {
      method: 'POST',
      body: JSON.stringify(body.payload),
    }),
  'push-unsubscribe': ({ api, body }) =>
    api.request(
      `/me/push-subscriptions/${(body.payload as { subscriptionId: string }).subscriptionId}`,
      { method: 'DELETE' },
    ),
} satisfies IntentMap;
