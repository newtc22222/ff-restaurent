import { useInfiniteQuery } from '@tanstack/react-query';
import type { CatalogPage, Cuisine, DiningArea } from '@/api/types';
import { session } from '@/lib/session';

export type CatalogLoader = (
  path: string,
) => Promise<CatalogPage<Cuisine | DiningArea>>;

export const defaultCatalogLoader: CatalogLoader = (path) =>
  session.api().request<CatalogPage<Cuisine | DiningArea>>(path);

export const restaurantCatalogQueryKeys = {
  all: ['restaurant-catalog'] as const,
  cuisines: (search: string) =>
    [...restaurantCatalogQueryKeys.all, 'cuisines', search] as const,
  diningAreas: (search: string) =>
    [...restaurantCatalogQueryKeys.all, 'dining-areas', search] as const,
};

const catalogPath = (
  resource: 'cuisines' | 'dining-areas',
  search: string,
  cursor: string | null,
) => {
  const query = new URLSearchParams({ search, limit: '25' });
  if (cursor) query.set('cursor', cursor);
  return `/${resource}?${query}`;
};

export const useCuisineCatalog = (search: string, loadCatalog: CatalogLoader) =>
  useInfiniteQuery({
    queryKey: restaurantCatalogQueryKeys.cuisines(search),
    queryFn: ({ pageParam }) =>
      loadCatalog(catalogPath('cuisines', search, pageParam)) as Promise<
        CatalogPage<Cuisine>
      >,
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.pageInfo.hasNextPage ? lastPage.pageInfo.endCursor : undefined,
    retry: false,
  });

export const useDiningAreaCatalog = (
  search: string,
  loadCatalog: CatalogLoader,
) =>
  useInfiniteQuery({
    queryKey: restaurantCatalogQueryKeys.diningAreas(search),
    queryFn: ({ pageParam }) =>
      loadCatalog(catalogPath('dining-areas', search, pageParam)) as Promise<
        CatalogPage<DiningArea>
      >,
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.pageInfo.hasNextPage ? lastPage.pageInfo.endCursor : undefined,
    retry: false,
  });
