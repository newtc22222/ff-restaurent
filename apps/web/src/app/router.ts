import type { ComponentType } from 'react';
import {
  createBrowserRouter,
  redirect,
  type RouteObject,
} from 'react-router';
import {
  App,
  AuthenticatedRoot,
  RouteErrorBoundary,
  RouteHydrateFallback,
} from './App';
import { session } from '@/lib/session';
import { canChef } from '@/lib/permissions';
import {
  appLoader,
  roleGuard,
} from './root.routes';
import { mutationAction } from './mutation-action';
import {
  loginAction,
  loginLoader,
} from '@/features/auth/auth.routes';
import {
  billActivityLoader,
  billsLoader,
} from '@/features/bills/bills.routes';
import {
  restaurantFeedbackLoader,
  restaurantsLoader,
} from '@/features/restaurants/restaurants.routes';
import {
  collectionDetailLoader,
  collectionsLoader,
} from '@/features/collections/collections.routes';
import { statsLoader } from '@/features/stats/stats.routes';
import { membersLoader } from '@/features/admin/admin.routes';

export {
  appLoader,
  billActivityLoader,
  billsLoader,
  collectionDetailLoader,
  collectionsLoader,
  loginAction,
  loginLoader,
  membersLoader,
  mutationAction,
  restaurantFeedbackLoader,
  restaurantsLoader,
  roleGuard,
  statsLoader,
};
export type { LoginActionData } from '@/features/auth/auth.routes';

const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({
  Component: (await load()).default,
});

const RedirectingRoute = () => null;

export const routes = [
  {
    path: '/login',
    loader: loginLoader,
    action: loginAction,
    lazy: page(() => import('@/features/auth/LoginPage')),
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
            lazy: page(() => import('@/features/bills/BillsPage')),
          },
          {
            path: 'restaurants',
            loader: restaurantsLoader,
            action: mutationAction,
            lazy: page(() => import('@/features/restaurants/RestaurantsPage')),
          },
          {
            path: 'collections',
            loader: collectionsLoader,
            action: mutationAction,
            lazy: page(() => import('@/features/collections/CollectionsPage')),
          },
          {
            path: 'participant-groups',
            action: mutationAction,
            lazy: page(
              () =>
                import('@/features/participant-groups/ParticipantGroupsPage'),
            ),
          },
          {
            path: 'stats',
            loader: statsLoader,
            lazy: page(() => import('@/features/stats/StatsPage')),
          },
          {
            path: 'admin',
            loader: membersLoader,
            action: mutationAction,
            lazy: page(() => import('@/features/admin/AdminPage')),
          },
          {
            path: 'bills/new',
            loader: (args) => roleGuard(canChef, args),
            action: mutationAction,
            lazy: page(() => import('@/features/bills/CreateBillPage')),
          },
          {
            path: 'bills/:billId/edit',
            loader: (args) => roleGuard(canChef, args),
            action: mutationAction,
            lazy: page(() => import('@/features/bills/CreateBillPage')),
          },
          {
            path: 'bills/:billId',
            loader: billActivityLoader,
            action: mutationAction,
            lazy: page(() => import('@/features/bills/BillDetailPage')),
          },
          {
            path: 'restaurants/:restaurantId',
            loader: restaurantFeedbackLoader,
            action: mutationAction,
            lazy: page(
              () => import('@/features/restaurants/RestaurantDetailPage'),
            ),
          },
          {
            path: 'collections/:collectionId',
            loader: collectionDetailLoader,
            action: mutationAction,
            lazy: page(
              () => import('@/features/collections/CollectionDetailPage'),
            ),
          },
          {
            path: 'profile',
            action: mutationAction,
            lazy: page(() => import('@/features/profile/ProfilePage')),
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
