import { type LoaderFunctionArgs, redirect } from 'react-router';

import { ApiError } from '@/api/client';
import type {
  CatalogPage,
  Cuisine,
  DiningArea,
  DiningAreaDetailData,
} from '@/api/types';
import type { IntentMap } from '@/app/mutation-types';
import { forwardListQuery } from '@/app/route-helpers';
import { session } from '@/lib/session';

const catalogQueryKeys = new Set([
  'cursor',
  'direction',
  'limit',
  'sort',
  'search',
]);

const loadCatalog = async <T>(request: Request, resource: string) => {
  const query = forwardListQuery(request, catalogQueryKeys);
  return session.api().request<CatalogPage<T>>(`/${resource}?${query}`);
};

export async function cuisinesLoader({ request }: LoaderFunctionArgs) {
  if (!session.getToken()) throw redirect('/login');
  try {
    return await loadCatalog<Cuisine>(request, 'cuisines');
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      session.clear();
      throw redirect('/login');
    }
    throw error;
  }
}

export async function diningAreasLoader({ request }: LoaderFunctionArgs) {
  if (!session.getToken()) throw redirect('/login');
  try {
    return await loadCatalog<DiningArea>(request, 'dining-areas');
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      session.clear();
      throw redirect('/login');
    }
    throw error;
  }
}

export async function diningAreaLoader({ params }: LoaderFunctionArgs) {
  if (!session.getToken()) throw redirect('/login');
  if (!params.diningAreaId)
    throw new Response('Dining Area id is required', { status: 400 });
  try {
    return await session
      .api()
      .request<DiningAreaDetailData>(`/dining-areas/${params.diningAreaId}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      session.clear();
      throw redirect('/login');
    }
    throw error;
  }
}

export const catalogIntents = {
  'create-cuisine': ({ api, body }) =>
    api.request('/cuisines', {
      method: 'POST',
      body: JSON.stringify(body.payload),
    }),
  'update-cuisine': ({ api, body }) =>
    api.request(`/cuisines/${body.catalogId}`, {
      method: 'PUT',
      body: JSON.stringify(body.payload),
    }),
  'delete-cuisine': ({ api, body }) =>
    api.request(`/cuisines/${body.catalogId}`, { method: 'DELETE' }),
  'create-dining-area': ({ api, body }) =>
    api.request('/dining-areas', {
      method: 'POST',
      body: JSON.stringify(body.payload),
    }),
  'update-dining-area': ({ api, body }) =>
    api.request(`/dining-areas/${body.catalogId}`, {
      method: 'PUT',
      body: JSON.stringify(body.payload),
    }),
  'delete-dining-area': ({ api, body }) =>
    api.request(`/dining-areas/${body.catalogId}`, { method: 'DELETE' }),
} satisfies IntentMap;
