import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient } from '@prisma/client';
import { bootstrapRootAdmin } from '../prisma/bootstrap-root-admin.js';

const client = (user: Record<string, unknown>) =>
  ({ user }) as unknown as PrismaClient;

// `bootstrapRootAdmin` defaults its second argument to
// `process.env.ROOT_ADMIN_USERNAME`, and importing Prisma Client loads
// `apps/api/.env` into the process. Pin the variable around any case that
// exercises that default so a developer's local .env cannot decide the result.
const withRootAdminUsername = async (
  value: string | undefined,
  run: () => Promise<void>,
) => {
  const previous = process.env.ROOT_ADMIN_USERNAME;
  if (value === undefined) delete process.env.ROOT_ADMIN_USERNAME;
  else process.env.ROOT_ADMIN_USERNAME = value;
  try {
    await run();
  } finally {
    if (previous === undefined) delete process.env.ROOT_ADMIN_USERNAME;
    else process.env.ROOT_ADMIN_USERNAME = previous;
  }
};

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
  await withRootAdminUsername(undefined, async () => {
    await assert.rejects(
      bootstrapRootAdmin(client({ findFirst: async () => null }), undefined),
      /ROOT_ADMIN_USERNAME is required/,
    );
  });
  // A blank or whitespace-only ROOT_ADMIN_USERNAME trims to '' and must fail
  // the same way; passing it explicitly keeps the case env-independent.
  await assert.rejects(
    bootstrapRootAdmin(client({ findFirst: async () => null }), ''),
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

test('root bootstrap falls back to ROOT_ADMIN_USERNAME from the environment', async () => {
  const lookups: unknown[] = [];
  await withRootAdminUsername('  env-configured-root  ', async () => {
    await assert.rejects(
      bootstrapRootAdmin(
        client({
          findFirst: async () => null,
          findUnique: async (args: unknown) => {
            lookups.push(args);
            return null;
          },
        }),
      ),
      /does not identify an existing user: env-configured-root/,
    );
  });

  assert.deepEqual(lookups, [
    {
      where: { username: 'env-configured-root' },
      select: { id: true, username: true },
    },
  ]);
});
