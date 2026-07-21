// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../app/providers/i18n';
import CollectionsPage from './CollectionsPage';
import CollectionDetailPage from './CollectionDetailPage';

const { mutate, routerState } = vi.hoisted(() => ({
  mutate: vi.fn(),
  routerState: {
    loaderData: null as unknown,
    navigate: vi.fn(),
    searchParams: new URLSearchParams(),
    setSearchParams: vi.fn(),
  },
}));

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return {
    ...actual,
    useLoaderData: () => routerState.loaderData,
    useNavigate: () => routerState.navigate,
    useSearchParams: () =>
      [routerState.searchParams, routerState.setSearchParams] as const,
  };
});

const owner = {
  id: 'owner-1',
  username: 'owner',
  name: 'Collection Owner',
  chefRole: null,
  systemRole: null,
  roles: ['CUSTOMER'],
};
const viewer = {
  id: 'viewer-1',
  username: 'viewer',
  name: 'Shared Viewer',
  chefRole: null,
  systemRole: null,
  roles: ['CUSTOMER'],
};
let currentUser = owner;

vi.mock('../hooks/useMutation', () => ({
  useMutation: () => ({ mutate }),
}));

vi.mock('../app/providers/app-context', () => ({
  useAppContext: () => ({
    user: currentUser,
    users: [owner, viewer],
    restaurants: [
      {
        id: 'restaurant-2',
        name: 'Available Place',
        address: '2 Test Street',
        cuisineType: 'Vietnamese',
        type: 'Restaurant',
        isRecommended: false,
        isFavorite: false,
        status: 'ACTIVE',
      },
    ],
  }),
}));

const collection = {
  id: 'collection-1',
  name: 'Team lunches',
  description: 'Shared places',
  isPublic: false,
  systemType: null,
  ownerId: owner.id,
  owner,
  _count: { restaurants: 1, shares: 1 },
  createdAt: '2026-07-15T00:00:00.000Z',
  updatedAt: '2026-07-15T00:00:00.000Z',
};
const restaurant = {
  id: 'restaurant-1',
  name: 'Bếp Việt',
  address: '1 Test Street',
  cuisineType: 'Vietnamese',
  type: 'Restaurant',
  isRecommended: false,
  isFavorite: false,
  status: 'ACTIVE',
  addedAt: '2026-07-15T00:00:00.000Z',
  cuisines: [],
};
const emptyPage = {
  items: [],
  pageInfo: { endCursor: null, hasNextPage: false },
};

const renderPage = (data: unknown, Component: ComponentType) => {
  routerState.loaderData = data;
  render(
    <I18nProvider>
      <Component />
    </I18nProvider>,
  );
};

beforeEach(() => {
  localStorage.setItem('ff-locale', 'en');
  mutate.mockReset();
  routerState.navigate.mockReset();
  routerState.setSearchParams.mockReset();
  routerState.searchParams = new URLSearchParams();
  currentUser = owner;
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('Collection discovery', () => {
  it('shows visibility, restaurant counts, and creates a Collection', async () => {
    renderPage(
      {
        items: [
          collection,
          {
            ...collection,
            id: 'recommended',
            name: 'Recommended',
            isPublic: true,
            systemType: 'RECOMMENDED',
            ownerId: null,
            owner: null,
            _count: { restaurants: 3, shares: 0 },
          },
        ],
        pageInfo: { endCursor: null, hasNextPage: false },
      },
      CollectionsPage,
    );

    expect(await screen.findByText('Team lunches')).toBeTruthy();
    expect(screen.getByLabelText('Visibility')).toBeTruthy();
    expect(screen.getByText('Shared by me')).toBeTruthy();
    expect(screen.getByText('3 places')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Create Collection' }));
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Client dinner' },
    });
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Create Collection' }).at(-1)!,
    );
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ intent: 'create-collection' }),
      expect.objectContaining({ success: 'Collection created.' }),
    );
  });

  it('keeps shared members read-only and gives owners management controls', async () => {
    currentUser = viewer;
    const sharedData = {
      collection,
      restaurants: { ...emptyPage, items: [restaurant] },
      shares: null,
    };
    renderPage(sharedData, CollectionDetailPage);
    expect(await screen.findByText('Bếp Việt')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByText('Sharing')).toBeNull();
    cleanup();

    currentUser = owner;
    renderPage({ ...sharedData, shares: emptyPage }, CollectionDetailPage);
    const edit = await screen.findByRole('button', { name: 'Edit' });
    expect(screen.getByText('Sharing')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Add' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.click(edit);
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    cleanup();

    renderPage(
      {
        ...sharedData,
        collection: { ...collection, isPublic: true },
        shares: emptyPage,
      },
      CollectionDetailPage,
    );
    expect(await screen.findByText('Bếp Việt')).toBeTruthy();
    expect(screen.queryByText('Sharing')).toBeNull();
  });
});
