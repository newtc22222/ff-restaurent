import { redirect, type LoaderFunctionArgs } from 'react-router';
import { ApiError } from '@/api/client';
import type {
  CatalogPage,
  Collection,
  CollectionDetailData,
  CollectionRestaurant,
  CollectionShare,
} from '@/api/types';
import { session } from '@/lib/session';
import { forwardListQuery } from '@/app/route-helpers';
import type { IntentMap } from '@/app/mutation-types';

export async function collectionsLoader({ request }: LoaderFunctionArgs) {
  if (!session.getToken()) throw redirect('/login');
  const query = forwardListQuery(
    request,
    new Set(['cursor', 'limit', 'sort', 'search', 'visibility', 'systemType']),
  );
  return session
    .api()
    .request<CatalogPage<Collection>>(`/collections?${query}`);
}

export async function collectionDetailLoader({
  params,
  request,
}: LoaderFunctionArgs): Promise<CollectionDetailData> {
  if (!session.getToken()) throw redirect('/login');
  if (!params.collectionId)
    throw new Response('Collection id is required', { status: 400 });
  const api = session.api();
  const collection = await api.request<Collection>(
    `/collections/${params.collectionId}`,
  );
  const source = new URL(request.url).searchParams;
  const query = new URLSearchParams();
  for (const key of ['cursor', 'limit', 'search', 'sort']) {
    const value = source.get(key);
    if (value) query.set(key, value);
  }
  const [restaurants, shares] = await Promise.all([
    api.request<CatalogPage<CollectionRestaurant>>(
      `/collections/${params.collectionId}/restaurants?${query}`,
    ),
    collection.ownerId && collection.systemType === null
      ? api
          .request<CatalogPage<CollectionShare>>(
            `/collections/${params.collectionId}/shares?limit=100`,
          )
          .catch((error) => {
            if (error instanceof ApiError && error.status === 403) return null;
            throw error;
          })
      : Promise.resolve(null),
  ]);
  return { collection, restaurants, shares };
}

export const collectionIntents = {
  'create-collection': ({ api, body }) =>
    api.request('/collections', {
      method: 'POST',
      body: JSON.stringify(body.payload),
    }),
  'update-collection': ({ api, body }) =>
    api.request(`/collections/${body.collectionId}`, {
      method: 'PUT',
      body: JSON.stringify(body.payload),
    }),
  'delete-collection': ({ api, body }) =>
    api.request(`/collections/${body.collectionId}`, { method: 'DELETE' }),
  'add-collection-restaurant': ({ api, body }) =>
    api.request(
      `/collections/${body.collectionId}/restaurants/${body.restaurantId}`,
      { method: 'POST' },
    ),
  'remove-collection-restaurant': ({ api, body }) =>
    api.request(
      `/collections/${body.collectionId}/restaurants/${body.restaurantId}`,
      { method: 'DELETE' },
    ),
  'share-collection': ({ api, body }) =>
    api.request(`/collections/${body.collectionId}/shares`, {
      method: 'POST',
      body: JSON.stringify({ userId: body.userId }),
    }),
  'unshare-collection': ({ api, body }) =>
    api.request(`/collections/${body.collectionId}/shares/${body.userId}`, {
      method: 'DELETE',
    }),
} satisfies IntentMap;
