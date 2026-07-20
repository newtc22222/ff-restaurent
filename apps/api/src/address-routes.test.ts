import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import { buildApp } from './app.js';
import { registerErrorHandler } from './http/error-handler.js';
import { registerAddressRoutes } from './routes/address-routes.js';
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

test('address routes serve the bundled directory without an external service', async () => {
  const app = Fastify();
  registerErrorHandler(app);
  registerAddressRoutes(app, { authenticate: async () => undefined });

  const provinces = await app.inject({
    method: 'GET',
    url: '/address/provinces',
  });
  const provinceBody = provinces.json();
  assert.equal(provinces.statusCode, 200);
  assert.equal(provinceBody.stale, false);
  assert.equal(provinceBody.items.length, 34);
  assert.deepEqual(
    provinceBody.items.find(
      (province: { code: string }) =>
        province.code === 'p-thanh-pho-ho-chi-minh',
    ).aliases,
    ['Bình Dương', 'Bà Rịa - Vũng Tàu'],
  );

  const wards = await app.inject({
    method: 'GET',
    url: '/address/provinces/p-thanh-pho-ho-chi-minh/wards',
  });
  assert.equal(wards.statusCode, 200);
  assert.equal(wards.json().items.length, 168);
  assert.equal(
    wards
      .json()
      .items.some((ward: { name: string }) => ward.name === 'Đặc khu Côn Đảo'),
    true,
  );

  const unknown = await app.inject({
    method: 'GET',
    url: '/address/provinces/p-not-a-province/wards',
  });
  assert.equal(unknown.statusCode, 404);
  assert.equal(unknown.json().code, 'ADDRESS_PROVINCE_NOT_FOUND');

  const legacyCode = await app.inject({
    method: 'GET',
    url: '/address/provinces/79/wards',
  });
  assert.equal(legacyCode.statusCode, 400);
  assert.equal(legacyCode.json().code, 'VALIDATION_ERROR');
  await app.close();
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
