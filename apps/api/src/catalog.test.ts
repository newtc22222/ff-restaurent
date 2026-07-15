import assert from 'node:assert/strict';
import test from 'node:test';
import {
  diningAreaKey,
  normalizeCatalogKey,
  normalizeDisplayText,
} from './catalog-normalization.js';
import { restaurantSchema } from './schemas.js';

test('catalog keys normalize casing and surrounding/internal whitespace', () => {
  assert.equal(normalizeDisplayText('  South   East  '), 'South East');
  assert.equal(normalizeCatalogKey('  VIETNAMESE  Food '), 'vietnamese food');
  assert.equal(
    diningAreaKey('  Downtown ', ' 12   Main Street '),
    diningAreaKey('downtown', '12 main street'),
  );
});

test('restaurant catalog selections require one included primary cuisine', () => {
  const base = {
    name: 'Catalog Restaurant',
    address: 'Manual address',
    cuisineType: 'Legacy snapshot',
    type: 'Restaurant',
  };
  assert.equal(
    restaurantSchema.safeParse({
      ...base,
      cuisineIds: ['cuisine-1', 'cuisine-2'],
      primaryCuisineId: 'cuisine-2',
    }).success,
    true,
  );
  assert.equal(
    restaurantSchema.safeParse({
      ...base,
      cuisineIds: ['cuisine-1'],
      primaryCuisineId: 'missing',
    }).success,
    false,
  );
  assert.equal(
    restaurantSchema.safeParse({
      ...base,
      cuisineIds: ['cuisine-1', 'cuisine-1'],
      primaryCuisineId: 'cuisine-1',
    }).success,
    false,
  );
});
