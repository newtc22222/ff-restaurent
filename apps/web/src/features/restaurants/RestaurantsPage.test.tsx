// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RestaurantDirectoryData } from '@/api/types';
import { I18nProvider } from '@/app/providers/i18n';

import RestaurantsPage from './RestaurantsPage';

const routerState = vi.hoisted(() => ({
  search: '',
  setSearchParams: vi.fn(),
}));

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return {
    ...actual,
    useLoaderData: () => directoryData,
    useNavigate: () => vi.fn(),
    useSearchParams: () => [
      new URLSearchParams(routerState.search),
      routerState.setSearchParams,
    ],
  };
});

vi.mock('@/app/providers/app-context', () => ({
  useAppContext: () => ({
    user: {
      id: 'head-1',
      username: 'head',
      name: 'Head Chef',
      chefRole: 'HEAD_CHEF',
      systemRole: null,
      roles: ['CUSTOMER', 'HEAD_CHEF'],
      paymentRemindersEnabled: true,
    },
    restaurants: [],
  }),
}));

vi.mock('@/hooks/useRouteMutation', () => ({
  useRouteMutation: () => ({ mutate: vi.fn() }),
}));

vi.mock('@/features/restaurants/restaurant-media.mutations', () => ({
  useRestaurantMediaMutation: () => ({ mutateAsync: vi.fn() }),
}));

const directoryData: RestaurantDirectoryData = {
  items: [],
  pageInfo: {
    startCursor: null,
    endCursor: null,
    hasPreviousPage: false,
    hasNextPage: false,
  },
  collections: [],
  cuisines: [
    {
      id: 'canonical',
      name: 'Canonical cuisine',
      type: 'Regional',
    },
  ],
};

const renderPage = (initialEntry: string) => {
  routerState.search = new URL(initialEntry, 'http://local.test').search;
  routerState.setSearchParams.mockImplementation((next) => {
    const params = new URLSearchParams(next);
    const search = params.toString();
    routerState.search = search ? `?${search}` : '';
  });
  render(
    <I18nProvider>
      <RestaurantsPage />
    </I18nProvider>,
  );
};

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('ff-locale', 'en');
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('RestaurantsPage Cuisine filters', () => {
  it('commits one settled search navigation with replacement history', () => {
    vi.useFakeTimers();
    renderPage('/restaurants?cursor=entry-1&direction=forward');
    const search = screen.getByRole('searchbox', {
      name: 'Search restaurants without accents...',
    });

    fireEvent.change(search, { target: { value: 'p' } });
    fireEvent.change(search, { target: { value: 'ph' } });
    fireEvent.change(search, { target: { value: 'pho' } });
    expect(routerState.setSearchParams).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(300));
    expect(routerState.setSearchParams).toHaveBeenCalledTimes(1);
    const [next, options] = routerState.setSearchParams.mock.calls[0]!;
    const params = new URLSearchParams(next);
    expect(params.get('search')).toBe('pho');
    expect(params.has('cursor')).toBe(false);
    expect(params.has('direction')).toBe(false);
    expect(options).toEqual({ replace: true });
  });

  it('offers canonical Cuisines that are absent from the current restaurant page', async () => {
    renderPage('/restaurants');

    fireEvent.click(
      await screen.findByRole('button', { name: 'Filter by cuisine' }),
    );

    expect(
      await screen.findByRole('option', { name: /Canonical cuisine/ }),
    ).toBeTruthy();
  });

  it('selects and switches Cuisine matching with one normalized URL update', async () => {
    renderPage(
      '/restaurants?cuisineId=old&primaryCuisineId=stale&cursor=entry-1&direction=forward',
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Filter by cuisine' }),
    );
    fireEvent.click(
      await screen.findByRole('option', { name: /Canonical cuisine/ }),
    );

    await waitFor(() => {
      const params = new URLSearchParams(routerState.search);
      expect(params.get('primaryCuisineId')).toBe('canonical');
      expect(params.has('cuisineId')).toBe(false);
      expect(params.has('cursor')).toBe(false);
      expect(params.has('direction')).toBe(false);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Primary cuisine' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Any cuisine' }));

    await waitFor(() => {
      const params = new URLSearchParams(routerState.search);
      expect(params.get('cuisineId')).toBe('canonical');
      expect(params.has('primaryCuisineId')).toBe(false);
    });
  });
});
