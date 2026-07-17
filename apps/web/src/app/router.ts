import type { ComponentType } from 'react';
import toast from 'react-hot-toast';
import {
  createBrowserRouter,
  data,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type RouteObject,
} from 'react-router';
import {
  App,
  AuthenticatedRoot,
  RouteErrorBoundary,
  RouteHydrateFallback,
} from './App';
import type { AppLoaderData } from './providers/app-context';
import {
  ApiError,
  type Bill,
  type BillActivityEvent,
  type CatalogPage,
  type Collection,
  type CollectionDetailData,
  type CollectionRestaurant,
  type CollectionShare,
  type Notification,
  type ParticipantGroup,
  type PasswordResetRequest,
  type RestaurantEntry,
  type RestaurantDetailData,
  type RestaurantFeedbackPage,
  type RestaurantDirectoryData,
  type Stats,
  type User,
} from '../lib/api';
import { session } from '../lib/session';
import { canChef, isRootAdmin } from '../lib/helpers';

const fetchAllPages = async <T>(path: string): Promise<T[]> => {
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

const statsRanges = new Set(['weekly', 'monthly', 'yearly', 'custom']);

export async function statsLoader({ request }: LoaderFunctionArgs) {
  if (!session.getToken()) throw redirect('/login');
  const url = new URL(request.url);
  const requestedRange = url.searchParams.get('range') ?? 'monthly';
  const range = statsRanges.has(requestedRange) ? requestedRange : 'monthly';
  const query = new URLSearchParams({ range });
  if (range === 'custom') {
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    if (from) query.set('from', from);
    if (to) query.set('to', to);
  }

  try {
    return await session.api().request<Stats>(`/stats/me?${query}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      session.clear();
      throw redirect('/login');
    }
    throw error;
  }
}

const forwardListQuery = (request: Request, allowed: Set<string>) => {
  const source = new URL(request.url).searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of source) {
    if (allowed.has(key) && value) query.append(key, value);
  }
  return query;
};

export async function billsLoader({ request }: LoaderFunctionArgs) {
  if (!session.getToken()) throw redirect('/login');
  const query = forwardListQuery(
    request,
    new Set([
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
    ]),
  );
  return session.api().request<CatalogPage<Bill>>(`/bills?${query}`);
}

export async function restaurantsLoader({ request }: LoaderFunctionArgs) {
  if (!session.getToken()) throw redirect('/login');
  const query = forwardListQuery(
    request,
    new Set([
      'cursor',
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

export async function loginLoader() {
  if (session.getToken()) throw redirect('/bills');
  void session
    .api()
    .request('/health')
    .catch(() => undefined);
  return null;
}

export async function billActivityLoader({ params }: LoaderFunctionArgs) {
  if (!session.getToken()) throw redirect('/login');
  if (!params.billId)
    throw new Response('Bill id is required', { status: 400 });
  try {
    return await session
      .api()
      .request<BillActivityEvent[]>(`/bills/${params.billId}/activity`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      session.clear();
      throw redirect('/login');
    }
    throw error;
  }
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

export type LoginActionData = {
  error?: string;
  code?: string;
  success?: boolean;
  intent: 'login' | 'register' | 'forgot-request' | 'forgot-reset';
};

export async function loginAction({ request }: ActionFunctionArgs) {
  const body = await request.json();
  const api = session.api();
  const intent: LoginActionData['intent'] =
    body.intent === 'register' ||
    body.intent === 'forgot-request' ||
    body.intent === 'forgot-reset'
      ? body.intent
      : 'login';

  try {
    if (intent === 'forgot-request') {
      await api.request('/auth/password-reset-requests', {
        method: 'POST',
        body: JSON.stringify({ identifier: body.identifier }),
      });
      return { success: true, intent } satisfies LoginActionData;
    }
    if (intent === 'forgot-reset') {
      await api.request('/auth/password-reset', {
        method: 'POST',
        body: JSON.stringify({
          identifier: body.identifier,
          code: body.code,
          newPassword: body.newPassword,
          confirmation: body.confirmation,
        }),
      });
      return { success: true, intent } satisfies LoginActionData;
    }
    const result =
      intent === 'register'
        ? await api.register(
            body.name,
            body.username,
            body.phone,
            body.password,
            body.inviteCode,
          )
        : await api.login(body.identifier, body.password);
    session.setToken(result.token);
    if (typeof body.toastSuccess === 'string') {
      toast.success(body.toastSuccess);
    }
    return redirect('/bills');
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status >= 400 &&
      error.status < 500
    ) {
      return data<LoginActionData>(
        { error: error.message, code: error.code, intent },
        { status: error.status },
      );
    }
    throw error;
  }
}

export async function mutationAction({ request, params }: ActionFunctionArgs) {
  if (!session.getToken()) throw redirect('/login');
  const body = await request.json();
  const api = session.api();
  try {
    switch (body.intent) {
      case 'create-bill': {
        const bill = await api.request<Bill>('/bills', {
          method: 'POST',
          body: JSON.stringify(body.payload),
        });
        if (typeof body.toastSuccess === 'string')
          toast.success(body.toastSuccess);
        return redirect(`/bills/${bill.id}`);
      }
      case 'update-bill':
        await api.request(`/bills/${params.billId}`, {
          method: 'PUT',
          body: JSON.stringify(body.payload),
        });
        if (typeof body.toastSuccess === 'string')
          toast.success(body.toastSuccess);
        return redirect(`/bills/${params.billId}`);
      case 'bill-status':
        return await api.request(
          `/bills/${body.billId ?? params.billId}/${body.status}`,
          { method: 'PATCH' },
        );
      case 'bill-reminders':
        return await api.request(
          `/bills/${body.billId ?? params.billId}/reminders`,
          { method: 'POST' },
        );
      case 'payment':
        return await api.request(
          `/bills/${params.billId}/participants/${body.memberId}/payment`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              status: body.status,
              expectedStatus: body.expectedStatus,
            }),
          },
        );
      case 'create-restaurant':
        return await api.request('/restaurants', {
          method: 'POST',
          body: JSON.stringify(body.payload),
        });
      case 'update-restaurant':
        return await api.request(`/restaurants/${params.restaurantId}`, {
          method: 'PUT',
          body: JSON.stringify(body.payload),
        });
      case 'update-restaurant-collections':
        return await api.request(
          `/restaurants/${params.restaurantId}/collections`,
          {
            method: 'PUT',
            body: JSON.stringify({ collectionIds: body.collectionIds }),
          },
        );
      case 'restaurant-favorite':
        return await api.request(
          `/restaurants/${body.restaurantId ?? params.restaurantId}/favorite`,
          { method: 'POST' },
        );
      case 'restaurant-recommend':
        return await api.request(
          `/restaurants/${body.restaurantId}/recommend`,
          {
            method: 'PATCH',
          },
        );
      case 'restaurant-status':
        return await api.request(
          `/restaurants/${body.restaurantId ?? params.restaurantId}/${body.status}`,
          { method: 'PATCH' },
        );
      case 'create-collection':
        return await api.request('/collections', {
          method: 'POST',
          body: JSON.stringify(body.payload),
        });
      case 'update-collection':
        return await api.request(`/collections/${body.collectionId}`, {
          method: 'PUT',
          body: JSON.stringify(body.payload),
        });
      case 'delete-collection':
        return await api.request(`/collections/${body.collectionId}`, {
          method: 'DELETE',
        });
      case 'add-collection-restaurant':
        return await api.request(
          `/collections/${body.collectionId}/restaurants/${body.restaurantId}`,
          { method: 'POST' },
        );
      case 'remove-collection-restaurant':
        return await api.request(
          `/collections/${body.collectionId}/restaurants/${body.restaurantId}`,
          { method: 'DELETE' },
        );
      case 'share-collection':
        return await api.request(`/collections/${body.collectionId}/shares`, {
          method: 'POST',
          body: JSON.stringify({ userId: body.userId }),
        });
      case 'unshare-collection':
        return await api.request(
          `/collections/${body.collectionId}/shares/${body.userId}`,
          { method: 'DELETE' },
        );
      case 'create-feedback':
        return await api.request(`/bills/${body.billId}/feedback`, {
          method: 'POST',
          body: JSON.stringify(body.payload),
        });
      case 'update-feedback':
        return await api.request(`/feedback/${body.feedbackId}`, {
          method: 'PUT',
          body: JSON.stringify(body.payload),
        });
      case 'delete-feedback':
        return await api.request(`/feedback/${body.feedbackId}`, {
          method: 'DELETE',
        });
      case 'create-participant-group':
        return await api.request('/participant-groups', {
          method: 'POST',
          body: JSON.stringify(body.payload),
        });
      case 'update-participant-group':
        return await api.request(`/participant-groups/${body.groupId}`, {
          method: 'PUT',
          body: JSON.stringify(body.payload),
        });
      case 'delete-participant-group':
        return await api.request(`/participant-groups/${body.groupId}`, {
          method: 'DELETE',
        });
      case 'update-role':
        return await api.request(`/users/${body.userId}/chef-role`, {
          method: 'PATCH',
          body: JSON.stringify({ chefRole: body.chefRole }),
        });
      case 'root-transfer':
        await api.request('/admin/root-transfer', {
          method: 'POST',
          body: JSON.stringify(body.payload),
        });
        session.clear();
        if (typeof body.toastSuccess === 'string')
          toast.success(body.toastSuccess);
        return redirect('/login');
      case 'update-profile':
        return await api.request('/me/profile', {
          method: 'PUT',
          body: JSON.stringify(body.payload),
        });
      case 'change-password': {
        const result = await api.request<{ token: string }>('/me/password', {
          method: 'PATCH',
          body: JSON.stringify(body.payload),
        });
        session.setToken(result.token);
        return { ok: true };
      }
      case 'issue-password-reset':
        return await api.request(
          `/admin/password-reset-requests/${body.requestId}/issue`,
          { method: 'POST' },
        );
      case 'reject-password-reset':
        return await api.request(
          `/admin/password-reset-requests/${body.requestId}/reject`,
          { method: 'POST' },
        );
      case 'read-notification':
        return await api.request(`/notifications/${body.notificationId}/read`, {
          method: 'PATCH',
        });
      case 'read-all-notifications':
        return await api.request('/notifications/read-all', {
          method: 'PATCH',
        });
      case 'notification-preferences':
        return await api.request('/me/notification-preferences', {
          method: 'PATCH',
          body: JSON.stringify(body.payload),
        });
      default:
        throw new Response('Unknown mutation intent', { status: 400 });
    }
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

const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({
  Component: (await load()).default,
});

const RedirectingRoute = () => null;

export const routes = [
  {
    path: '/login',
    loader: loginLoader,
    action: loginAction,
    lazy: page(() => import('../pages/LoginPage')),
    ErrorBoundary: RouteErrorBoundary,
    HydrateFallback: RouteHydrateFallback,
  },
  {
    id: 'app',
    path: '/',
    loader: appLoader,
    Component: AuthenticatedRoot,
    ErrorBoundary: RouteErrorBoundary,
    HydrateFallback: RouteHydrateFallback,
    children: [
      {
        index: true,
        loader: () => redirect('/bills'),
        Component: RedirectingRoute,
      },
      {
        Component: App,
        children: [
          {
            path: 'bills',
            loader: billsLoader,
            action: mutationAction,
            lazy: page(() => import('../pages/BillsPage')),
          },
          {
            path: 'restaurants',
            loader: restaurantsLoader,
            action: mutationAction,
            lazy: page(() => import('../pages/RestaurantsPage')),
          },
          {
            path: 'collections',
            loader: collectionsLoader,
            action: mutationAction,
            lazy: page(() => import('../pages/CollectionsPage')),
          },
          {
            path: 'participant-groups',
            action: mutationAction,
            lazy: page(() => import('../pages/ParticipantGroupsPage')),
          },
          {
            path: 'stats',
            loader: statsLoader,
            lazy: page(() => import('../pages/StatsPage')),
          },
          {
            path: 'admin',
            loader: (args) => roleGuard(isRootAdmin, args),
            action: mutationAction,
            lazy: page(() => import('../pages/AdminPage')),
          },
          {
            path: 'bills/new',
            loader: (args) => roleGuard(canChef, args),
            action: mutationAction,
            lazy: page(() => import('../pages/CreateBillPage')),
          },
          {
            path: 'bills/:billId/edit',
            loader: (args) => roleGuard(canChef, args),
            action: mutationAction,
            lazy: page(() => import('../pages/CreateBillPage')),
          },
          {
            path: 'bills/:billId',
            loader: billActivityLoader,
            action: mutationAction,
            lazy: page(() => import('../pages/BillDetailPage')),
          },
          {
            path: 'restaurants/:restaurantId',
            loader: restaurantFeedbackLoader,
            action: mutationAction,
            lazy: page(() => import('../pages/RestaurantDetailPage')),
          },
          {
            path: 'collections/:collectionId',
            loader: collectionDetailLoader,
            action: mutationAction,
            lazy: page(() => import('../pages/CollectionDetailPage')),
          },
          {
            path: 'profile',
            action: mutationAction,
            lazy: page(() => import('../pages/ProfilePage')),
          },
          {
            path: '*',
            loader: () => redirect('/bills'),
            Component: RedirectingRoute,
          },
        ],
      },
    ],
  },
  {
    path: '*',
    loader: () => redirect(session.getToken() ? '/bills' : '/login'),
    Component: RedirectingRoute,
  },
] satisfies RouteObject[];

export const router = createBrowserRouter(routes);
