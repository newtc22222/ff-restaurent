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
} satisfies IntentMap;
