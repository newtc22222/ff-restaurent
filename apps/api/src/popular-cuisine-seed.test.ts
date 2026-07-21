import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeCatalogKey } from './catalog-normalization.js';
import {
  POPULAR_VIETNAM_CUISINE_SOURCE,
  popularVietnamCuisines,
  seedPopularVietnamCuisines,
  type PopularCuisineSeedClient,
} from './popular-cuisine-seed.js';

test('popular Vietnam cuisine seed has deterministic unique catalog keys', () => {
  assert.equal(popularVietnamCuisines.length, 21);
  assert.equal(
    new Set(popularVietnamCuisines.map(({ nameKey }) => nameKey)).size,
    popularVietnamCuisines.length,
  );
  assert.equal(
    popularVietnamCuisines.every(
      ({ name, nameKey, type, description }) =>
        nameKey === normalizeCatalogKey(name) &&
        type.length > 0 &&
        Boolean(description),
    ),
    true,
  );
  assert.equal(
    POPULAR_VIETNAM_CUISINE_SOURCE,
    'https://vietnam.travel/node/195',
  );
});

test('popular Vietnam cuisine seed inserts without overwriting duplicates', async () => {
  const calls: unknown[] = [];
  const client = {
    cuisine: {
      createMany: async (input: unknown) => {
        calls.push(input);
        return { count: 18 };
      },
    },
  } as PopularCuisineSeedClient;

  const result = await seedPopularVietnamCuisines(client);

  assert.deepEqual(calls, [
    { data: popularVietnamCuisines, skipDuplicates: true },
  ]);
  assert.deepEqual(result, { created: 18, skipped: 3, total: 21 });
});
