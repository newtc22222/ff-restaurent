import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationDirectory =
  '../apps/api/prisma/migrations/20260730100000_add_dining_area_images/';
const readMigrationFile = (name) =>
  readFile(new URL(`${migrationDirectory}${name}`, import.meta.url), 'utf8');

test('Dining Area images have ordered storage metadata and one default reference', async () => {
  const migration = await readMigrationFile('migration.sql');

  assert.match(migration, /CREATE TABLE "DiningAreaImage"/);
  assert.match(migration, /"storagePath" TEXT NOT NULL/);
  assert.match(migration, /"mimeType" TEXT NOT NULL/);
  assert.match(migration, /"sizeBytes" INTEGER NOT NULL/);
  assert.match(migration, /"sortOrder" INTEGER NOT NULL/);
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "DiningAreaImage_diningAreaId_sortOrder_key"/,
  );
  assert.match(migration, /ADD COLUMN "defaultImageId" TEXT/);
  assert.match(
    migration,
    /"DiningArea_defaultImageId_fkey"[\s\S]*ON DELETE SET NULL/,
  );
  assert.match(
    migration,
    /"DiningAreaImage_diningAreaId_fkey"[\s\S]*ON DELETE CASCADE/,
  );
});

test('Dining Area image migration includes an explicit operator rollback', async () => {
  const rollback = await readMigrationFile('rollback.sql');

  const dropDefaultRelation = rollback.indexOf(
    'DROP CONSTRAINT IF EXISTS "DiningArea_defaultImageId_fkey"',
  );
  const dropDefaultColumn = rollback.indexOf(
    'DROP COLUMN IF EXISTS "defaultImageId"',
  );
  const dropImages = rollback.indexOf('DROP TABLE IF EXISTS "DiningAreaImage"');

  assert.ok(dropDefaultRelation >= 0);
  assert.ok(dropDefaultColumn > dropDefaultRelation);
  assert.ok(dropImages > dropDefaultColumn);
});
