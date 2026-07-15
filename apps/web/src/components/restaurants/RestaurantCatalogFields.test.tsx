// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../app/providers/i18n';
import type { CatalogPage, Cuisine, DiningArea } from '../../lib/api';
import RestaurantCatalogFields, {
  emptyRestaurantCatalogs,
} from './RestaurantCatalogFields';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('ff-locale', 'en');
});
afterEach(cleanup);

const loader = vi.fn(async (path: string) => {
  const url = new URL(path, 'http://local.test');
  if (url.pathname === '/cuisines') {
    const search = url.searchParams.get('search');
    if (search === 'thai') {
      return {
        items: [{ id: 'thai', name: 'Thai', type: 'Regional' }],
        pageInfo: { endCursor: null, hasNextPage: false },
      } satisfies CatalogPage<Cuisine>;
    }
    if (url.searchParams.get('cursor')) {
      return {
        items: [{ id: 'japanese', name: 'Japanese', type: 'Regional' }],
        pageInfo: { endCursor: null, hasNextPage: false },
      } satisfies CatalogPage<Cuisine>;
    }
    return {
      items: [{ id: 'vietnamese', name: 'Vietnamese', type: 'Regional' }],
      pageInfo: { endCursor: 'vietnamese', hasNextPage: true },
    } satisfies CatalogPage<Cuisine>;
  }
  return {
    items: [
      {
        id: 'downtown',
        name: 'Downtown',
        address: '12 Main Street',
      },
    ],
    pageInfo: { endCursor: null, hasNextPage: false },
  } satisfies CatalogPage<DiningArea>;
});

function Harness() {
  const [value, setValue] = useState(emptyRestaurantCatalogs());
  const [primaryName, setPrimaryName] = useState('');
  return (
    <I18nProvider>
      <RestaurantCatalogFields
        value={value}
        onChange={setValue}
        onPrimaryCuisineNameChange={setPrimaryName}
        loadCatalog={loader}
      />
      <output data-testid="catalogs">
        {JSON.stringify({ ...value, primaryName })}
      </output>
    </I18nProvider>
  );
}

describe('RestaurantCatalogFields', () => {
  it('searches and paginates on the server while enforcing one primary cuisine', async () => {
    render(<Harness />);
    await screen.findByRole('button', { name: 'Load more cuisines' });

    fireEvent.click(screen.getByRole('button', { name: 'Cuisines' }));
    fireEvent.click(await screen.findByRole('option', { name: /Vietnamese/ }));
    expect(screen.getByTestId('catalogs').textContent).toContain(
      '"primaryCuisineId":"vietnamese"',
    );
    expect(screen.getByTestId('catalogs').textContent).toContain(
      '"primaryName":"Vietnamese"',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cuisines' }));

    fireEvent.click(screen.getByRole('button', { name: 'Load more cuisines' }));
    await waitFor(() =>
      expect(loader).toHaveBeenCalledWith(
        expect.stringContaining('cursor=vietnamese'),
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cuisines' }));
    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Search cuisines...' }),
      {
        target: { value: 'thai' },
      },
    );
    await waitFor(() =>
      expect(loader).toHaveBeenCalledWith(
        expect.stringContaining('search=thai'),
      ),
    );
    expect(await screen.findByRole('option', { name: /Thai/ })).toBeTruthy();
  });

  it('selects and clears an optional Dining Area from server results', async () => {
    render(<Harness />);
    const area = await screen.findByRole('button', { name: 'Dining Area' });
    expect(area.className).toContain('bg-surface');
    fireEvent.click(area);
    fireEvent.click(await screen.findByRole('option', { name: /Downtown/ }));
    expect(screen.getByTestId('catalogs').textContent).toContain(
      '"diningAreaId":"downtown"',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Dining Area' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByTestId('catalogs').textContent).toContain(
      '"diningAreaId":null',
    );
  });
});
