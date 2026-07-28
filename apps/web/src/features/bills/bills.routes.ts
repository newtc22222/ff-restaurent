import toast from 'react-hot-toast';
import { redirect, type LoaderFunctionArgs } from 'react-router';
import {
  forwardListQuery,
  requireToken,
  rethrowRouteError,
} from '@/app/route-helpers';
import type { Bill, BillActivityEvent, CatalogPage } from '@/api/types';
import { session } from '@/lib/session';
import type {
  IntentContext,
  IntentMap,
  MutationBody,
} from '@/app/mutation-types';

/**
 * Route data and mutations owned by the bills feature.
 *
 * Keeping these here rather than in app/router.ts means adding or changing a
 * bill endpoint touches only this slice, and bills no longer participate in a
 * central multi-domain mutation switch.
 */

const BILL_LIST_PARAMS = new Set([
  'cursor',
  'direction',
  'limit',
  'sort',
  'restaurantId',
  'participantId',
  'participantIds',
  'paymentStatus',
  'archive',
  'ownerId',
  'from',
  'to',
]);

export async function billsLoader({ request }: LoaderFunctionArgs) {
  requireToken();
  const query = forwardListQuery(request, BILL_LIST_PARAMS);
  return session.api().request<CatalogPage<Bill>>(`/bills?${query}`);
}

export async function billActivityLoader({ params }: LoaderFunctionArgs) {
  requireToken();
  if (!params.billId)
    throw new Response('Bill id is required', { status: 400 });
  try {
    return await session
      .api()
      .request<BillActivityEvent[]>(`/bills/${params.billId}/activity`);
  } catch (error) {
    return rethrowRouteError(error);
  }
}

/**
 * Body shape the shared mutation action passes through. Kept loose because the
 * intents are dispatched dynamically; each handler reads what it needs.
 */
const announce = (body: MutationBody) => {
  if (typeof body.toastSuccess === 'string') toast.success(body.toastSuccess);
};

/**
 * Bill mutation intents, keyed by the intent name the UI submits. The router
 * merges this into its dispatch table; error handling and 401 redirects stay
 * centralized there so behavior is identical across domains.
 */
export const billIntents = {
  'create-bill': async ({ api, body }: IntentContext) => {
    const bill = await api.request<Bill>('/bills', {
      method: 'POST',
      body: JSON.stringify(body.payload),
    });
    announce(body);
    return redirect(`/bills/${bill.id}`);
  },
  'update-bill': async ({ api, body, params }: IntentContext) => {
    await api.request(`/bills/${params.billId}`, {
      method: 'PUT',
      body: JSON.stringify(body.payload),
    });
    announce(body);
    return redirect(`/bills/${params.billId}`);
  },
  'bill-status': ({ api, body, params }: IntentContext) =>
    api.request(`/bills/${body.billId ?? params.billId}/${body.status}`, {
      method: 'PATCH',
    }),
  'bill-reminders': ({ api, body, params }: IntentContext) =>
    api.request(`/bills/${body.billId ?? params.billId}/reminders`, {
      method: 'POST',
    }),
  payment: ({ api, body, params }: IntentContext) =>
    api.request(
      `/bills/${params.billId}/participants/${body.memberId}/payment`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          status: body.status,
          expectedStatus: body.expectedStatus,
        }),
      },
    ),
} satisfies IntentMap;
