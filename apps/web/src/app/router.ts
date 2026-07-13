import type { ComponentType } from 'react';
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
  type RestaurantEntry,
  type Stats,
  type User,
} from '../lib/api';
import { session } from '../lib/session';
import { canChef, isHead } from '../lib/helpers';

export async function appLoader(): Promise<AppLoaderData> {
  if (!session.getToken()) throw redirect('/login');
  const api = session.api();
  try {
    const user = await api.request<User>('/me');
    const results = await Promise.allSettled([
      api.request<Bill[]>('/bills?includeArchived=true'),
      api.request<RestaurantEntry[]>('/restaurants?includeArchived=true'),
      api.request<Stats>('/stats/me?range=monthly'),
      api.request<User[]>(
        user.chefRole === 'HEAD_CHEF' ? '/users' : '/members',
      ),
      api.request<Notification[]>('/notifications'),
    ]);
    const value = <T>(result: PromiseSettledResult<T>, fallback: T) =>
      result.status === 'fulfilled' ? result.value : fallback;
    return {
      user,
      bills: value(results[0], []),
      restaurants: value(results[1], []),
      stats: value(results[2], null),
      users: value(results[3], []),
      notifications: value(results[4], []),
      warning: results.some((result) => result.status === 'rejected')
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

async function loginLoader() {
  if (session.getToken()) throw redirect('/bills');
  return null;
}

export type LoginActionData = {
  error: string;
  code?: string;
  intent: 'login' | 'register';
};

export async function loginAction({ request }: ActionFunctionArgs) {
  const body = await request.json();
  const api = session.api();
  const intent = body.intent === 'register' ? 'register' : 'login';

  try {
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
  switch (body.intent) {
    case 'create-bill': {
      const bill = await api.request<Bill>('/bills', {
        method: 'POST',
        body: JSON.stringify(body.payload),
      });
      return redirect(`/bills/${bill.id}`);
    }
    case 'update-bill':
      await api.request(`/bills/${params.billId}`, {
        method: 'PUT',
        body: JSON.stringify(body.payload),
      });
      return redirect(`/bills/${params.billId}`);
    case 'bill-status':
      return api.request(
        `/bills/${body.billId ?? params.billId}/${body.status}`,
        { method: 'PATCH' },
      );
    case 'bill-reminders':
      return api.request(`/bills/${body.billId ?? params.billId}/reminders`, {
        method: 'POST',
      });
    case 'payment':
      return api.request(
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
      return api.request('/restaurants', {
        method: 'POST',
        body: JSON.stringify(body.payload),
      });
    case 'restaurant-favorite':
      return api.request(
        `/restaurants/${body.restaurantId ?? params.restaurantId}/favorite`,
        { method: 'POST' },
      );
    case 'restaurant-recommend':
      return api.request(`/restaurants/${body.restaurantId}/recommend`, {
        method: 'PATCH',
      });
    case 'restaurant-status':
      return api.request(
        `/restaurants/${body.restaurantId ?? params.restaurantId}/${body.status}`,
        { method: 'PATCH' },
      );
    case 'update-role':
      return api.request(`/users/${body.userId}/chef-role`, {
        method: 'PATCH',
        body: JSON.stringify({ chefRole: body.chefRole }),
      });
    case 'update-profile':
      return api.request('/me/profile', {
        method: 'PUT',
        body: JSON.stringify(body.payload),
      });
    case 'read-notification':
      return api.request(`/notifications/${body.notificationId}/read`, {
        method: 'PATCH',
      });
    default:
      throw new Response('Unknown mutation intent', { status: 400 });
  }
}

async function roleGuard(
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
            loader: (args) => roleGuard(isHead, args),
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
