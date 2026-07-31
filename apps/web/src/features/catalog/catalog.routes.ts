import { type LoaderFunctionArgs, redirect } from 'react-router';

import { ApiError } from '@/api/client';
import type {
  CatalogPage,
  Cuisine,
  DiningArea,
  DiningAreaDetailData,
} from '@/api/types';
import type { IntentMap } from '@/app/mutation-types';
import { queryClient } from '@/app/providers/query';
import { forwardListQuery } from '@/app/route-helpers';
import { restaurantCatalogQueryKeys } from '@/features/restaurants/restaurant-catalog.queries';
import { session } from '@/lib/session';

/**
 * FF-65: catalog GETs are cached (private, short-lived) at the HTTP layer,
 * and `useCuisineCatalog`/`useDiningAreaCatalog` (used outside the route
 * loaders, e.g. the restaurant form picker) hold their own TanStack Query
 * cache. Route loaders auto-revalidate after an action; this cache doesn't,
 * so authorized catalog writes must invalidate it explicitly.
 */
const invalidateCatalogQueries = () =>
  queryClient.invalidateQueries({ queryKey: restaurantCatalogQueryKeys.all });

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
  'create-cuisine': async ({ api, body }) => {
    const result = await api.request('/cuisines', {
      method: 'POST',
      body: JSON.stringify(body.payload),
    });
    await invalidateCatalogQueries();
    return result;
  },
  'update-cuisine': async ({ api, body }) => {
    const result = await api.request(`/cuisines/${body.catalogId}`, {
      method: 'PUT',
      body: JSON.stringify(body.payload),
    });
    await invalidateCatalogQueries();
    return result;
  },
  'delete-cuisine': async ({ api, body }) => {
    const result = await api.request(`/cuisines/${body.catalogId}`, {
      method: 'DELETE',
    });
    await invalidateCatalogQueries();
    return result;
  },
  'create-dining-area': async ({ api, body }) => {
    const result = await api.request('/dining-areas', {
      method: 'POST',
      body: JSON.stringify(body.payload),
    });
    await invalidateCatalogQueries();
    return result;
  },
  'update-dining-area': async ({ api, body }) => {
    const result = await api.request(`/dining-areas/${body.catalogId}`, {
      method: 'PUT',
      body: JSON.stringify(body.payload),
    });
    await invalidateCatalogQueries();
    return result;
  },
  'delete-dining-area': async ({ api, body }) => {
    const result = await api.request(`/dining-areas/${body.catalogId}`, {
      method: 'DELETE',
    });
    await invalidateCatalogQueries();
    return result;
  },
} satisfies IntentMap;
