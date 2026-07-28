import { redirect, type LoaderFunctionArgs } from 'react-router';
import { ApiError } from '@/api/client';
import type {
  CatalogPage,
  Collection,
  RestaurantDetailData,
  RestaurantDirectoryData,
  RestaurantEntry,
  RestaurantFeedbackPage,
} from '@/api/types';
import { session } from '@/lib/session';
import { forwardListQuery } from '@/app/route-helpers';
import { fetchAllPages } from '@/app/root.routes';
import type { IntentMap } from '@/app/mutation-types';

export async function restaurantsLoader({ request }: LoaderFunctionArgs) {
  if (!session.getToken()) throw redirect('/login');
  const query = forwardListQuery(
    request,
    new Set([
      'cursor',
      'direction',
      'limit',
      'sort',
      'search',
      'cuisineId',
      'primaryCuisineId',
      'diningAreaId',
      'collectionId',
      'platform',
      'archive',
      'favorite',
      'recommended',
    ]),
  );
  const [page, collections] = await Promise.all([
    session
      .api()
      .request<CatalogPage<RestaurantEntry>>(`/restaurants?${query}`),
    fetchAllPages<Collection>('/collections?limit=100'),
  ]);
  return { ...page, collections } satisfies RestaurantDirectoryData;
}

export async function restaurantFeedbackLoader({
  params,
  request,
}: LoaderFunctionArgs) {
  if (!session.getToken()) throw redirect('/login');
  if (!params.restaurantId)
    throw new Response('Restaurant id is required', { status: 400 });
  const url = new URL(request.url);
  const query = new URLSearchParams();
  const cursor = url.searchParams.get('cursor');
  if (cursor) query.set('cursor', cursor);
  try {
    const api = session.api();
    const [restaurant, feedback, collections] = await Promise.all([
      api.request<RestaurantDetailData['restaurant']>(
        `/restaurants/${params.restaurantId}`,
      ),
      api.request<RestaurantFeedbackPage>(
        `/restaurants/${params.restaurantId}/feedback?${query}`,
      ),
      fetchAllPages<Collection>('/collections?limit=100'),
    ]);
    return { restaurant, feedback, collections } satisfies RestaurantDetailData;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      session.clear();
      throw redirect('/login');
    }
    throw error;
  }
}

export const restaurantIntents = {
  'create-restaurant': ({ api, body }) =>
    api.request('/restaurants', {
      method: 'POST',
      body: JSON.stringify(body.payload),
    }),
  'update-restaurant': ({ api, body, params }) =>
    api.request(`/restaurants/${params.restaurantId}`, {
      method: 'PUT',
      body: JSON.stringify(body.payload),
    }),
  'update-restaurant-collections': ({ api, body, params }) =>
    api.request(`/restaurants/${params.restaurantId}/collections`, {
      method: 'PUT',
      body: JSON.stringify({ collectionIds: body.collectionIds }),
    }),
  'restaurant-favorite': ({ api, body, params }) =>
    api.request(
      `/restaurants/${body.restaurantId ?? params.restaurantId}/favorite`,
      { method: 'POST' },
    ),
  'restaurant-recommend': ({ api, body }) =>
    api.request(`/restaurants/${body.restaurantId}/recommend`, {
      method: 'PATCH',
    }),
  'restaurant-status': ({ api, body, params }) =>
    api.request(
      `/restaurants/${body.restaurantId ?? params.restaurantId}/${body.status}`,
      { method: 'PATCH' },
    ),
  'create-feedback': ({ api, body }) =>
    api.request(`/bills/${body.billId}/feedback`, {
      method: 'POST',
      body: JSON.stringify(body.payload),
    }),
  'update-feedback': ({ api, body }) =>
    api.request(`/feedback/${body.feedbackId}`, {
      method: 'PUT',
      body: JSON.stringify(body.payload),
    }),
  'delete-feedback': ({ api, body }) =>
    api.request(`/feedback/${body.feedbackId}`, { method: 'DELETE' }),
} satisfies IntentMap;
