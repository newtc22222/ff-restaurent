import { type ActionFunctionArgs, data, redirect } from 'react-router';

import { ApiError } from '@/api/client';
import { adminIntents } from '@/features/admin/admin.routes';
import { billIntents } from '@/features/bills/bills.routes';
import { collectionIntents } from '@/features/collections/collections.routes';
import { notificationIntents } from '@/features/notifications/notification.routes';
import { participantGroupIntents } from '@/features/participant-groups/participant-groups.routes';
import { profileIntents } from '@/features/profile/profile.routes';
import { restaurantIntents } from '@/features/restaurants/restaurants.routes';
import { session } from '@/lib/session';

import type { IntentMap, MutationBody } from './mutation-types';

const mutationIntents: IntentMap = {
  ...billIntents,
  ...restaurantIntents,
  ...collectionIntents,
  ...participantGroupIntents,
  ...adminIntents,
  ...profileIntents,
  ...notificationIntents,
};

export async function mutationAction({ request, params }: ActionFunctionArgs) {
  if (!session.getToken()) throw redirect('/login');
  const body = (await request.json()) as MutationBody;
  const api = session.api();
  try {
    const intent = mutationIntents[body.intent];
    if (!intent) throw new Response('Unknown mutation intent', { status: 400 });
    return await intent({ api, body, params });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      session.clear();
      throw redirect('/login');
    }
    if (error instanceof ApiError) {
      return data(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    throw error;
  }
}
