// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import CatalogDirectoryPage from './CatalogDirectoryPage';

const setPage = vi.fn();
const { loaderData, navigate } = vi.hoisted(() => ({
  loaderData: { current: null as unknown },
  navigate: vi.fn(),
}));

const cuisinePage = {
  items: [
    {
      id: 'cuisine-1',
      name: 'Bánh cuốn',
      type: 'Bánh',
      description: 'Rice rolls',
    },
  ],
  pageInfo: {
    startCursor: 'cuisine-1',
    endCursor: 'cuisine-1',
    hasPreviousPage: true,
    hasNextPage: true,
  },
};
loaderData.current = cuisinePage;

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return {
    ...actual,
    useLoaderData: () => loaderData.current,
    useNavigate: () => navigate,
  };
});

vi.mock('@/app/providers/app-context', () => ({
  useAppContext: () => ({
    user: {
      id: 'chef-1',
      roles: ['CUSTOMER', 'SOUS_CHEF'],
      chefRole: 'SOUS_CHEF',
      systemRole: null,
    },
  }),
}));

vi.mock('@/app/providers/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('@/hooks/useRouteMutation', () => ({
  useRouteMutation: () => ({ mutate: vi.fn() }),
}));

vi.mock('@/hooks/useUrlFilters', () => ({
  useUrlFilters: () => ({
    searchValue: '',
    setSearchValue: vi.fn(),
    setPage,
  }),
}));

afterEach(() => {
  cleanup();
  localStorage.clear();
  setPage.mockReset();
  navigate.mockReset();
  loaderData.current = cuisinePage;
});

describe('Cuisine directory layouts', () => {
  it('defaults to a table and switches to card layout', () => {
    render(<CatalogDirectoryPage kind="cuisines" />);

    expect(screen.getByRole('table')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'catalog.cardLayout' }));
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText('Bánh cuốn')).toBeTruthy();
  });

  it('exposes both cursor pagination directions', () => {
    render(<CatalogDirectoryPage kind="cuisines" />);

    fireEvent.click(
      screen.getByRole('button', { name: 'common.previousPage' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'common.nextPage' }));

    expect(setPage).toHaveBeenNthCalledWith(1, 'cuisine-1', 'backward');
    expect(setPage).toHaveBeenNthCalledWith(2, 'cuisine-1', 'forward');
  });

  it('uses comfortable vertical padding in the Cuisine description editor', () => {
    render(<CatalogDirectoryPage kind="cuisines" />);

    fireEvent.click(screen.getByRole('button', { name: /common.add/i }));

    expect(
      screen.getByRole('textbox', { name: 'catalog.description' }).className,
    ).toContain('py-2');
  });
});

describe('Dining Area directory imagery', () => {
  it('removes the background layer when the default image fails', () => {
    loaderData.current = {
      items: [
        {
          id: 'area-1',
          name: 'Rooftop',
          address: '1 Example Street',
          description: 'Open-air dining.',
          defaultImage: {
            id: 'image-1',
            imageUrl: 'https://example.com/missing.jpg',
          },
        },
      ],
      pageInfo: {
        startCursor: 'area-1',
        endCursor: 'area-1',
        hasPreviousPage: false,
        hasNextPage: false,
      },
    };
    const { container } = render(<CatalogDirectoryPage kind="dining-areas" />);
    const background = container.querySelector('img');

    expect(background).not.toBeNull();
    fireEvent.error(background!);

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('Rooftop')).toBeTruthy();
  });
});
