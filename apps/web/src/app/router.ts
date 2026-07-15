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
  type Notification,
  type PasswordResetRequest,
  type RestaurantEntry,
  type Stats,
  type User,
} from '../lib/api';
import { session } from '../lib/session';
import { canChef, isRootAdmin } from '../lib/helpers';

export async function appLoader(): Promise<AppLoaderData> {
  if (!session.getToken()) throw redirect('/login');
  const api = session.api();
  try {
    const userPromise = api.request<User>('/me');
    const sharedResultsPromise = Promise.allSettled([
      api.request<Bill[]>('/bills?includeArchived=true'),
      api.request<RestaurantEntry[]>('/restaurants?includeArchived=true'),
      api.request<Stats>('/stats/me?range=monthly'),
      api.request<Notification[]>('/notifications'),
    ]);
    const user = await userPromise;
    const [sharedResults, usersResult, passwordResetRequestsResult] =
      await Promise.all([
        sharedResultsPromise,
        api
          .request<User[]>(
            user.systemRole === 'ROOT_ADMIN' ? '/users' : '/members',
          )
          .then(
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
      sharedResults[2],
      usersResult,
      sharedResults[3],
    ] as const;
    const value = <T>(result: PromiseSettledResult<T>, fallback: T) =>
      result.status === 'fulfilled' ? result.value : fallback;
    return {
      user,
      bills: value(results[0], []),
      restaurants: value(results[1], []),
      stats: value(results[2], null),
      users: value(results[3], []),
      notifications: value(results[4], []),
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

export async function loginLoader() {
  if (session.getToken()) throw redirect('/bills');
  void session
    .api()
    .request('/health')
    .catch(() => undefined);
  return null;
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
            action: mutationAction,
            lazy: page(() => import('../pages/BillsPage')),
          },
          {
            path: 'restaurants',
            action: mutationAction,
            lazy: page(() => import('../pages/RestaurantsPage')),
          },
          { path: 'stats', lazy: page(() => import('../pages/StatsPage')) },
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
            action: mutationAction,
            lazy: page(() => import('../pages/BillDetailPage')),
          },
          {
            path: 'restaurants/:restaurantId',
            action: mutationAction,
            lazy: page(() => import('../pages/RestaurantDetailPage')),
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
