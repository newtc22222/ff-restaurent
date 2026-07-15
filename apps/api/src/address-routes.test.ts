import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApp } from './app.js';
import {
  normalizeVietnamAddressSnapshot,
  restaurantSchema,
} from './schemas.js';

test('address directory endpoints require authentication', async () => {
  const app = await buildApp();
  const provinces = await app.inject({
    method: 'GET',
    url: '/address/provinces',
  });
  const wards = await app.inject({
    method: 'GET',
    url: '/address/provinces/79/wards',
  });
  await app.close();

  assert.equal(provinces.statusCode, 401);
  assert.equal(wards.statusCode, 401);
});

test('restaurant addresses accept complete structured or manual snapshots', () => {
  const base = {
    name: 'Lunch',
    cuisineType: 'Vietnamese',
    type: 'Restaurant',
  };
  assert.equal(
    restaurantSchema.safeParse({ ...base, address: 'Manual address' }).success,
    true,
  );
  assert.equal(
    restaurantSchema.safeParse({
      ...base,
      address: '12 Lê Lợi, Phường Bến Nghé, Thành phố Hồ Chí Minh',
      addressLine: '12 Lê Lợi',
      provinceCode: '79',
      provinceName: 'Thành phố Hồ Chí Minh',
      wardCode: '26734',
      wardName: 'Phường Bến Nghé',
    }).success,
    true,
  );
  assert.equal(
    restaurantSchema.safeParse({
      ...base,
      address: 'Incomplete address',
      provinceCode: '79',
    }).success,
    false,
  );
  assert.equal(
    normalizeVietnamAddressSnapshot({
      address: 'Client supplied snapshot',
      addressLine: '12 Lê Lợi',
      provinceCode: '79',
      provinceName: 'Thành phố Hồ Chí Minh',
      wardCode: '26734',
      wardName: 'Phường Bến Nghé',
    }).address,
    '12 Lê Lợi, Phường Bến Nghé, Thành phố Hồ Chí Minh',
  );
  assert.deepEqual(
    normalizeVietnamAddressSnapshot({ address: 'Manual replacement' }),
    {
      address: 'Manual replacement',
      addressLine: null,
      provinceCode: null,
      provinceName: null,
      wardCode: null,
      wardName: null,
    },
  );
});
