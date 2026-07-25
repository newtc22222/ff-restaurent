import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { planUserPhoneBackfill } from '../src/phone-backfill.js';

const prisma = new PrismaClient();
const contractMigration =
  '20260720000000_contract_phase2_normalized_restaurants';
const expectedIndexes = new Map([
  ['Notification_userId_createdAt_id_idx', '("userId", "createdAt", id)'],
  ['Notification_userId_readAt_idx', '("userId", "readAt")'],
  [
    'Notification_billId_userId_createdAt_idx',
    '("billId", "userId", "createdAt")',
  ],
  ['BillAuditLog_billId_createdAt_id_idx', '("billId", "createdAt", id)'],
]);
const migrationsDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  'migrations',
);

type CountRow = { count: bigint };
type ForeignKeyRow = {
  constraintName: string;
  validated: boolean;
  orphanSql: string;
};

const count = async (sql: string) => {
  const rows = await prisma.$queryRawUnsafe<CountRow[]>(sql);
  return Number(rows[0]?.count ?? 0n);
};

const check = (passed: boolean, actual: number, expected = 0) => ({
  passed,
  actual,
  expected,
});

const run = async () => {
  const expectedMigrations = (
    await readdir(migrationsDirectory, {
      withFileTypes: true,
    })
  )
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const migrationRows = await prisma.$queryRaw<
    Array<{
      migrationName: string;
      finished: boolean;
      rolledBack: boolean;
    }>
  >`
    SELECT
      migration_name AS "migrationName",
      finished_at IS NOT NULL AS finished,
      rolled_back_at IS NOT NULL AS "rolledBack"
    FROM "_prisma_migrations"
    ORDER BY migration_name
  `;
  const completedMigrations = migrationRows
    .filter((migration) => migration.finished && !migration.rolledBack)
    .map((migration) => migration.migrationName);
  const rolledBackMigrations = migrationRows.filter(
    (migration) => migration.rolledBack,
  ).length;
  const migrationInventoryMatches =
    expectedMigrations.length === 17 &&
    completedMigrations.length === expectedMigrations.length &&
    expectedMigrations.every(
      (migration, index) => completedMigrations[index] === migration,
    );
  const contractMigrationCount = completedMigrations.filter(
    (migration) => migration === contractMigration,
  ).length;

  const [
    rootAdminCount,
    restaurantsWithoutOnePrimaryCuisine,
    usersWithoutOneFavoritesCollection,
    recommendedCollectionCount,
    legacyColumnCount,
    legacyTableCount,
    monetaryTypeMismatchCount,
    negativeMonetaryRowCount,
    allocationMismatchCount,
  ] = await Promise.all([
    count(`SELECT COUNT(*) AS count FROM "User"
      WHERE "systemRole" = 'ROOT_ADMIN'`),
    count(`SELECT COUNT(*) AS count FROM "RestaurantEntry" restaurant
      WHERE (SELECT COUNT(*) FROM "RestaurantCuisine" cuisine
        WHERE cuisine."restaurantId" = restaurant."id"
          AND cuisine."isPrimary") <> 1`),
    count(`SELECT COUNT(*) AS count FROM "User" user_record
      WHERE (SELECT COUNT(*) FROM "Collection" collection
        WHERE collection."ownerId" = user_record."id"
          AND collection."systemType" = 'FAVORITES') <> 1`),
    count(`SELECT COUNT(*) AS count FROM "Collection"
      WHERE "systemType" = 'RECOMMENDED'`),
    count(`SELECT COUNT(*) AS count FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'RestaurantEntry'
        AND column_name IN
          ('cuisineType', 'links', 'isFavorite', 'isRecommended')`),
    count(`SELECT COUNT(*) AS count FROM information_schema.tables
      WHERE table_schema = current_schema() AND table_name = 'UserFavorite'`),
    count(`WITH expected(table_name, column_name) AS (
        VALUES
          ('Bill', 'baseCost'),
          ('Bill', 'vat'),
          ('Bill', 'shippingFee'),
          ('Bill', 'totalCost'),
          ('BillParticipant', 'originCost'),
          ('BillParticipant', 'allocatedVat'),
          ('BillParticipant', 'allocatedShipping'),
          ('BillParticipant', 'discountApplied'),
          ('BillParticipant', 'finalPrice')
      )
      SELECT COUNT(*) AS count
      FROM expected
      LEFT JOIN information_schema.columns column_info
        ON column_info.table_schema = current_schema()
        AND column_info.table_name = expected.table_name
        AND column_info.column_name = expected.column_name
      WHERE column_info.data_type <> 'integer'
        OR column_info.data_type IS NULL`),
    count(`SELECT
        (SELECT COUNT(*) FROM "Bill"
          WHERE "baseCost" < 0 OR "vat" < 0 OR "shippingFee" < 0
            OR "totalCost" < 0)
        +
        (SELECT COUNT(*) FROM "BillParticipant"
          WHERE "originCost" < 0 OR "allocatedVat" < 0
            OR "allocatedShipping" < 0 OR "discountApplied" < 0
            OR "finalPrice" < 0)
        AS count`),
    count(`SELECT COUNT(*) AS count
      FROM "Bill" bill
      LEFT JOIN (
        SELECT
          "billId",
          SUM("originCost") AS origin,
          SUM("allocatedVat") AS vat,
          SUM("allocatedShipping") AS shipping,
          SUM("discountApplied") AS discount,
          SUM("finalPrice") AS final
        FROM "BillParticipant"
        GROUP BY "billId"
      ) participant ON participant."billId" = bill."id"
      WHERE COALESCE(participant.origin, 0) <> bill."baseCost"
        OR COALESCE(participant.vat, 0) <> bill."vat"
        OR COALESCE(participant.shipping, 0) <> bill."shippingFee"
        OR COALESCE(participant.discount, 0)
          <> bill."baseCost" + bill."vat" + bill."shippingFee"
            - bill."totalCost"
        OR COALESCE(participant.final, 0) <> bill."totalCost"`),
  ]);

  const foreignKeys = await prisma.$queryRawUnsafe<ForeignKeyRow[]>(`
    WITH key_columns AS (
      SELECT
        constraint_row.oid AS constraint_oid,
        constraint_row.conname AS constraint_name,
        constraint_row.convalidated AS validated,
        source_namespace.nspname AS source_schema,
        source_table.relname AS source_table,
        target_namespace.nspname AS target_schema,
        target_table.relname AS target_table,
        source_key.ordinality,
        source_attribute.attname AS source_column,
        target_attribute.attname AS target_column
      FROM pg_constraint constraint_row
      JOIN pg_class source_table
        ON source_table.oid = constraint_row.conrelid
      JOIN pg_namespace source_namespace
        ON source_namespace.oid = source_table.relnamespace
      JOIN pg_class target_table
        ON target_table.oid = constraint_row.confrelid
      JOIN pg_namespace target_namespace
        ON target_namespace.oid = target_table.relnamespace
      JOIN unnest(constraint_row.conkey) WITH ORDINALITY
        AS source_key(attribute_number, ordinality) ON TRUE
      JOIN unnest(constraint_row.confkey) WITH ORDINALITY
        AS target_key(attribute_number, ordinality)
        ON target_key.ordinality = source_key.ordinality
      JOIN pg_attribute source_attribute
        ON source_attribute.attrelid = source_table.oid
        AND source_attribute.attnum = source_key.attribute_number
      JOIN pg_attribute target_attribute
        ON target_attribute.attrelid = target_table.oid
        AND target_attribute.attnum = target_key.attribute_number
      WHERE constraint_row.contype = 'f'
        AND source_namespace.nspname = current_schema()
    )
    SELECT
      constraint_name AS "constraintName",
      bool_and(validated) AS validated,
      format(
        'SELECT COUNT(*) AS count FROM %I.%I child WHERE (%s) AND NOT EXISTS (SELECT 1 FROM %I.%I parent WHERE %s)',
        source_schema,
        source_table,
        string_agg(format('child.%I IS NOT NULL', source_column), ' AND ' ORDER BY ordinality),
        target_schema,
        target_table,
        string_agg(format('child.%I = parent.%I', source_column, target_column), ' AND ' ORDER BY ordinality)
      ) AS "orphanSql"
    FROM key_columns
    GROUP BY
      constraint_oid,
      constraint_name,
      source_schema,
      source_table,
      target_schema,
      target_table
    ORDER BY constraint_name
  `);
  let orphanRowCount = 0;
  for (const foreignKey of foreignKeys) {
    orphanRowCount += await count(foreignKey.orphanSql);
  }
  const unvalidatedForeignKeyCount = foreignKeys.filter(
    (foreignKey) => !foreignKey.validated,
  ).length;

  const installedIndexes = await prisma.$queryRaw<
    Array<{ indexName: string; indexDefinition: string }>
  >`
    SELECT indexname AS "indexName", indexdef AS "indexDefinition"
    FROM pg_indexes
    WHERE schemaname = current_schema()
      AND indexname IN (
        'Notification_userId_createdAt_id_idx',
        'Notification_userId_readAt_idx',
        'Notification_billId_userId_createdAt_idx',
        'BillAuditLog_billId_createdAt_id_idx'
      )
    ORDER BY indexname
  `;
  const indexDefinitionMismatchCount = [...expectedIndexes].filter(
    ([indexName, columns]) => {
      const installed = installedIndexes.find(
        (index) => index.indexName === indexName,
      );
      return !installed?.indexDefinition.endsWith(columns);
    },
  ).length;

  const phoneRecords = await prisma.user.findMany({
    where: { phone: { not: null } },
    select: { id: true, phone: true },
  });
  const phonePlan = planUserPhoneBackfill(
    phoneRecords.flatMap((record) =>
      record.phone ? [{ id: record.id, phone: record.phone }] : [],
    ),
  );

  const checks = {
    migrationInventory: check(
      migrationInventoryMatches,
      completedMigrations.length,
      17,
    ),
    rolledBackMigrations: check(
      rolledBackMigrations === 0,
      rolledBackMigrations,
    ),
    contractMigration: check(
      contractMigrationCount === 1,
      contractMigrationCount,
      1,
    ),
    rootAdmin: check(rootAdminCount === 1, rootAdminCount, 1),
    primaryCuisine: check(
      restaurantsWithoutOnePrimaryCuisine === 0,
      restaurantsWithoutOnePrimaryCuisine,
    ),
    favoritesCollections: check(
      usersWithoutOneFavoritesCollection === 0,
      usersWithoutOneFavoritesCollection,
    ),
    recommendedCollection: check(
      recommendedCollectionCount === 1,
      recommendedCollectionCount,
      1,
    ),
    legacyColumns: check(legacyColumnCount === 0, legacyColumnCount),
    legacyTable: check(legacyTableCount === 0, legacyTableCount),
    foreignKeysValidated: check(
      unvalidatedForeignKeyCount === 0,
      unvalidatedForeignKeyCount,
    ),
    foreignKeyOrphans: check(orphanRowCount === 0, orphanRowCount),
    requiredIndexes: check(
      indexDefinitionMismatchCount === 0,
      indexDefinitionMismatchCount,
    ),
    monetaryColumnTypes: check(
      monetaryTypeMismatchCount === 0,
      monetaryTypeMismatchCount,
    ),
    negativeMonetaryRows: check(
      negativeMonetaryRowCount === 0,
      negativeMonetaryRowCount,
    ),
    participantAllocations: check(
      allocationMismatchCount === 0,
      allocationMismatchCount,
    ),
    invalidPhones: check(
      phonePlan.invalid.length === 0,
      phonePlan.invalid.length,
    ),
    phoneCollisions: check(
      phonePlan.collisions.length === 0,
      phonePlan.collisions.length,
    ),
    pendingPhoneNormalization: check(
      phonePlan.updates.length === 0,
      phonePlan.updates.length,
    ),
  };
  const report = {
    formatVersion: 1,
    checkedAt: new Date().toISOString(),
    counts: {
      expectedMigrations: expectedMigrations.length,
      completedMigrations: completedMigrations.length,
      foreignKeys: foreignKeys.length,
      requiredIndexes: installedIndexes.length,
      phones: phoneRecords.length,
    },
    checks,
    passed: Object.values(checks).every((result) => result.passed),
  };
  const outputPath = process.env.MIGRATION_REHEARSAL_REPORT_PATH;
  if (outputPath) {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, {
      mode: 0o600,
    });
  }
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
};

run().finally(() => prisma.$disconnect());
