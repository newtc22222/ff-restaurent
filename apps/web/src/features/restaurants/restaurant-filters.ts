export type CuisineMatch = 'all' | 'primary';

const resetPagination = (searchParams: URLSearchParams) => {
  searchParams.delete('cursor');
  searchParams.delete('direction');
};

export const readCuisineFilter = (searchParams: URLSearchParams) => {
  const primaryCuisineId = searchParams.get('primaryCuisineId');
  if (searchParams.has('primaryCuisineId')) {
    return {
      cuisineId: primaryCuisineId ?? '',
      match: 'primary' as const,
    };
  }
  return {
    cuisineId: searchParams.get('cuisineId') ?? '',
    match: 'all' as const,
  };
};

export const updateCuisineFilter = (
  current: URLSearchParams,
  cuisineId: string,
  match: CuisineMatch,
) => {
  const next = new URLSearchParams(current);
  resetPagination(next);
  next.delete('cuisineId');
  next.delete('primaryCuisineId');
  if (cuisineId) {
    next.set(match === 'primary' ? 'primaryCuisineId' : 'cuisineId', cuisineId);
  }
  return next;
};

export const updateCuisineMatch = (
  current: URLSearchParams,
  match: CuisineMatch,
) => {
  const { cuisineId } = readCuisineFilter(current);
  return updateCuisineFilter(current, cuisineId, match);
};
