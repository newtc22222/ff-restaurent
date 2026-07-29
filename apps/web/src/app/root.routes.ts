import { type LoaderFunctionArgs, redirect } from 'react-router';

import { ApiError } from '@/api/client';
import type {
  Bill,
  CatalogPage,
  Notification,
  ParticipantGroup,
  PasswordResetRequest,
  RestaurantEntry,
  User,
} from '@/api/types';
import { session } from '@/lib/session';

import type { AppLoaderData } from './providers/app-context';

export const fetchAllPages = async <T>(path: string): Promise<T[]> => {
  const items: T[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 1000; page += 1) {
    const separator = path.includes('?') ? '&' : '?';
    const response: CatalogPage<T> = await session
      .api()
      .request<CatalogPage<T>>(
        `${path}${cursor ? `${separator}cursor=${encodeURIComponent(cursor)}` : ''}`,
      );
    items.push(...response.items);
    if (!response.pageInfo.hasNextPage || !response.pageInfo.endCursor) break;
    cursor = response.pageInfo.endCursor;
  }
  return items;
};

export async function appLoader(): Promise<AppLoaderData> {
  if (!session.getToken()) throw redirect('/login');
  const api = session.api();
  try {
    const userPromise = api.request<User>('/me');
    const sharedResultsPromise = Promise.allSettled([
      fetchAllPages<Bill>('/bills?archive=all&limit=100'),
      fetchAllPages<RestaurantEntry>('/restaurants?archive=all&limit=100'),
      api.request<Notification[]>('/notifications'),
      api.request<ParticipantGroup[]>('/participant-groups'),
    ]);
    const user = await userPromise;
    const [sharedResults, usersResult, passwordResetRequestsResult] =
      await Promise.all([
        sharedResultsPromise,
        fetchAllPages<User>(
          `${user.systemRole === 'ROOT_ADMIN' ? '/users' : '/members'}?limit=100`,
        ).then(
          (value): PromiseSettledResult<User[]> => ({
            status: 'fulfilled',
            value,
          }),
          (reason): PromiseSettledResult<User[]> => ({
            status: 'rejected',
            reason,
          }),
        ),
        user.systemRole === 'ROOT_ADMIN'
          ? api
              .request<PasswordResetRequest[]>('/admin/password-reset-requests')
              .then(
                (value): PromiseSettledResult<PasswordResetRequest[]> => ({
                  status: 'fulfilled',
                  value,
                }),
                (reason): PromiseSettledResult<PasswordResetRequest[]> => ({
                  status: 'rejected',
                  reason,
                }),
              )
          : Promise.resolve<PromiseSettledResult<PasswordResetRequest[]>>({
              status: 'fulfilled',
              value: [],
            }),
      ]);
    const results = [
      sharedResults[0],
      sharedResults[1],
      usersResult,
      sharedResults[2],
      sharedResults[3],
    ] as const;
    const value = <T>(result: PromiseSettledResult<T>, fallback: T) =>
      result.status === 'fulfilled' ? result.value : fallback;
    return {
      user,
      bills: value(results[0], []),
      restaurants: value(results[1], []),
      users: value(results[2], []),
      notifications: value(results[3], []),
      participantGroups: value(results[4], []),
      passwordResetRequests: value(passwordResetRequestsResult, []),
      warning: [...results, passwordResetRequestsResult].some(
        (result) => result.status === 'rejected',
      )
        ? 'Some data could not be refreshed. Your session is still active.'
        : null,
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      session.clear();
      throw redirect('/login');
    }
    throw error;
  }
}

export async function roleGuard(
  predicate: (user: User) => boolean,
  _args: LoaderFunctionArgs,
) {
  if (!session.getToken()) throw redirect('/login');
  try {
    const user = await session.api().request<User>('/me');
    if (!predicate(user)) throw redirect('/bills');
    return null;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      session.clear();
      throw redirect('/login');
    }
    throw error;
  }
}
