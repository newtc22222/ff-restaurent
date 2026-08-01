import assert from 'node:assert/strict';
import test from 'node:test';

import { buildApp } from '../app.js';
import {
  publicUserResponseSchema,
  userResponseSchema,
} from '../schemas/index.js';

test('every application operation exposes runtime responses and a stable operation id', async () => {
  const app = await buildApp();
  await app.ready();
  type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
  type Operation = {
    operationId?: string;
    responses?: Record<string, unknown>;
  };
  const document = app.swagger() as unknown as {
    paths?: Record<string, Partial<Record<Method, Operation>>>;
    components?: { schemas?: Record<string, unknown> };
  };

  let operationCount = 0;
  for (const pathItem of Object.values(document.paths ?? {})) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
      const operation = pathItem?.[method];
      if (!operation) continue;
      operationCount += 1;
      assert.match(operation.operationId ?? '', /^(get|post|put|patch|delete)/);
      assert.ok(operation.responses?.['2XX']);
      assert.ok(operation.responses?.['4XX']);
      assert.ok(operation.responses?.['5XX']);
    }
  }

  assert.equal(operationCount, 88);
  assert.deepEqual(Object.keys(document.components?.schemas ?? {}).sort(), [
    'AdjustmentAllocation',
    'AdjustmentType',
    'Bill',
    'ChefRole',
    'Collection',
    'CollectionSystemType',
    'EntryStatus',
    'PaymentStatus',
    'RestaurantEntry',
    'RestaurantPlatform',
    'SystemRole',
    'User',
    'UserAccountStatus',
  ]);
  await app.close();
});

test('runtime request validation uses the OpenAPI Zod schema', async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: {},
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.json(), {
    code: 'VALIDATION_ERROR',
    message: 'Request validation failed',
    issues: [
      { path: 'identifier', message: 'Required' },
      { path: 'password', message: 'Required' },
    ],
  });
  await app.close();
});

test('nested public users omit derived roles while full users require them', () => {
  const publicUser = {
    id: 'user-1',
    username: 'member',
    name: 'Member',
    chefRole: null,
    systemRole: null,
  };

  assert.equal(publicUserResponseSchema.parse(publicUser).id, 'user-1');
  assert.throws(() => userResponseSchema.parse(publicUser));
  assert.equal(
    userResponseSchema.parse({
      ...publicUser,
      accountStatus: 'ACTIVE',
      roles: ['CUSTOMER'],
    }).id,
    'user-1',
  );
});
