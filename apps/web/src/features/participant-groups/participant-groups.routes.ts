import type { IntentMap } from '@/app/mutation-types';

export const participantGroupIntents = {
  'create-participant-group': ({ api, body }) =>
    api.request('/participant-groups', {
      method: 'POST',
      body: JSON.stringify(body.payload),
    }),
  'update-participant-group': ({ api, body }) =>
    api.request(`/participant-groups/${body.groupId}`, {
      method: 'PUT',
      body: JSON.stringify(body.payload),
    }),
  'delete-participant-group': ({ api, body }) =>
    api.request(`/participant-groups/${body.groupId}`, { method: 'DELETE' }),
} satisfies IntentMap;
