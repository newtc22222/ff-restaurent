import assert from 'node:assert/strict';
import test from 'node:test';

import type { PrismaClient } from '@prisma/client';

import { bootstrapRootAdmin } from '../../prisma/scripts/bootstrap-root-admin.js';

const client = (user: Record<string, unknown>) =>
  ({ user }) as unknown as PrismaClient;

test('root bootstrap keeps an existing database root authoritative', async () => {
  let candidateLookup = false;
  const result = await bootstrapRootAdmin(
    client({
      findFirst: async () => ({ id: 'root', username: 'database-root' }),
      findUnique: async () => {
        candidateLookup = true;
        return null;
      },
    }),
    'different-configured-user',
  );

  assert.equal(result.status, 'existing');
  assert.equal(result.user.username, 'database-root');
  assert.equal(candidateLookup, false);
});

test('root bootstrap promotes the configured existing username once', async () => {
  const updates: unknown[] = [];
  const result = await bootstrapRootAdmin(
    client({
      findFirst: async () => null,
      findUnique: async () => ({ id: 'candidate', username: 'root-user' }),
      update: async (args: unknown) => {
        updates.push(args);
        return { id: 'candidate', username: 'root-user' };
      },
    }),
    'root-user',
  );

  assert.equal(result.status, 'promoted');
  assert.equal(updates.length, 1);
  assert.deepEqual((updates[0] as { data: unknown }).data, {
    systemRole: 'ROOT_ADMIN',
    sessionVersion: { increment: 1 },
  });
});

test('root bootstrap fails closed without a valid configured account', async () => {
  await assert.rejects(
    bootstrapRootAdmin(
      client({ findFirst: async () => null, findUnique: async () => null }),
      '',
    ),
    /ROOT_ADMIN_USERNAME is required/,
  );
  await assert.rejects(
    bootstrapRootAdmin(
      client({
        findFirst: async () => null,
        findUnique: async () => null,
      }),
      'missing-user',
    ),
    /does not identify an existing user/,
  );
});

test('root bootstrap creates a new root admin user if configured with password and missing from db', async () => {
  const createdData: unknown[] = [];
  const result = await bootstrapRootAdmin(
    client({
      findFirst: async () => null,
      findUnique: async () => null,
      create: async (args: unknown) => {
        createdData.push(args);
        return { id: 'new-root', username: 'f1fine' };
      },
    }),
    'f1fine',
    '111222333',
  );

  assert.equal(result.status, 'created');
  assert.equal(result.user.username, 'f1fine');
  assert.equal(createdData.length, 1);
});
