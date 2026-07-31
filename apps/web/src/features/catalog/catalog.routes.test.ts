import { afterEach, describe, expect, it, vi } from 'vitest';

import * as queryProvider from '@/app/providers/query';

import { restaurantCatalogQueryKeys } from '../restaurants/restaurant-catalog.queries';
import { catalogIntents } from './catalog.routes';

const fakeApi = (result: unknown) => ({
  request: vi.fn().mockResolvedValue(result),
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('catalogIntents', () => {
  it('invalidates the active query client after each catalog mutation', async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(queryProvider, 'getActiveQueryClient').mockReturnValue({
      invalidateQueries,
    } as never);

    const cases: Array<[keyof typeof catalogIntents, unknown]> = [
      ['create-cuisine', { payload: { name: 'Drinks', type: 'Beverage' } }],
      ['update-cuisine', { catalogId: 'c1', payload: { name: 'Drinks' } }],
      ['delete-cuisine', { catalogId: 'c1' }],
      [
        'create-dining-area',
        { payload: { name: 'District 1', address: 'HCMC' } },
      ],
      [
        'update-dining-area',
        { catalogId: 'd1', payload: { name: 'District 1' } },
      ],
      ['delete-dining-area', { catalogId: 'd1' }],
    ];

    for (const [intentName, body] of cases) {
      invalidateQueries.mockClear();
      const api = fakeApi({ id: 'result' });
      await catalogIntents[intentName]({
        api: api as never,
        body: body as never,
        params: {},
      });

      expect(api.request).toHaveBeenCalledTimes(1);
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: restaurantCatalogQueryKeys.all,
      });
    }
  });

  it('does not invalidate the cache when the request fails', async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(queryProvider, 'getActiveQueryClient').mockReturnValue({
      invalidateQueries,
    } as never);
    const api = {
      request: vi.fn().mockRejectedValue(new Error('network error')),
    };

    await expect(
      catalogIntents['create-cuisine']({
        api: api as never,
        body: { payload: { name: 'Drinks', type: 'Beverage' } } as never,
        params: {},
      }),
    ).rejects.toThrow('network error');

    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it('tolerates no active query client (e.g. between provider mounts) without throwing', async () => {
    vi.spyOn(queryProvider, 'getActiveQueryClient').mockReturnValue(null);
    const api = fakeApi({ id: 'result' });

    await expect(
      catalogIntents['delete-cuisine']({
        api: api as never,
        body: { catalogId: 'c1' } as never,
        params: {},
      }),
    ).resolves.toBeDefined();
  });
});
