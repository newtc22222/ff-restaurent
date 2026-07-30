import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL(
  '../apps/api/prisma/migrations/20260728102000_add_bill_occurred_on/migration.sql',
  import.meta.url,
);
const rollbackUrl = new URL(
  '../apps/api/prisma/migrations/20260728102000_add_bill_occurred_on/rollback.sql',
  import.meta.url,
);
const rehearsalVerifierUrl = new URL(
  '../apps/api/prisma/scripts/verify-migration-rehearsal.ts',
  import.meta.url,
);

test('bill occurrence-date migration backfills a deterministic Ho Chi Minh date', async () => {
  const sql = await readFile(migrationUrl, 'utf8');

  assert.match(sql, /ADD COLUMN "occurredOn" DATE/);
  assert.match(
    sql,
    /"createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia\/Ho_Chi_Minh'/,
  );
  assert.match(sql, /ALTER COLUMN "occurredOn" SET NOT NULL/);
  assert.match(sql, /CURRENT_TIMESTAMP AT TIME ZONE 'Asia\/Ho_Chi_Minh'/);
  assert.match(sql, /Bill_status_occurredOn_createdAt_id_idx/);
  assert.doesNotMatch(sql, /UPDATE "Bill"\s+SET "createdAt"/);
  assert.doesNotMatch(sql, /UPDATE "Bill"\s+SET "updatedAt"/);
});

test('bill occurrence-date migration has an explicit operator rollback', async () => {
  const sql = await readFile(rollbackUrl, 'utf8');

  assert.match(sql, /DROP COLUMN "occurredOn"/);
  assert.match(sql, /Bill_status_createdAt_id_idx/);
  assert.match(sql, /Bill_restaurantId_createdAt_id_idx/);
  assert.match(sql, /Bill_createdById_createdAt_id_idx/);
  assert.doesNotMatch(sql, /UPDATE "Bill"/);
});

test('migration rehearsal derives its expected inventory from the filesystem', async () => {
  const source = await readFile(rehearsalVerifierUrl, 'utf8');

  assert.match(
    source,
    /completedMigrations\.length === expectedMigrations\.length/,
  );
  assert.doesNotMatch(source, /expectedMigrations\.length === 17/);
});
