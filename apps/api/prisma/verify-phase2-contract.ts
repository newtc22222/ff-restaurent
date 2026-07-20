import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { prisma } from '../src/prisma.js';

const scalar = async (sql: string) => {
  const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(sql);
  return Number(rows[0]?.count ?? 0n);
};

const run = async () => {
  const [
    restaurantsWithoutOnePrimaryCuisine,
    usersWithoutOneFavoritesCollection,
    recommendedCollectionCount,
    legacyColumnCount,
    legacyTableCount,
    migrationCount,
  ] = await Promise.all([
    scalar(`SELECT COUNT(*) AS count FROM "RestaurantEntry" restaurant
      WHERE (SELECT COUNT(*) FROM "RestaurantCuisine" cuisine
        WHERE cuisine."restaurantId" = restaurant."id" AND cuisine."isPrimary") <> 1`),
    scalar(`SELECT COUNT(*) AS count FROM "User" user_record
      WHERE (SELECT COUNT(*) FROM "Collection" collection
        WHERE collection."ownerId" = user_record."id"
          AND collection."systemType" = 'FAVORITES') <> 1`),
    prisma.collection.count({ where: { systemType: 'RECOMMENDED' } }),
    scalar(`SELECT COUNT(*) AS count FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'RestaurantEntry'
        AND column_name IN ('cuisineType', 'links', 'isFavorite', 'isRecommended')`),
    scalar(`SELECT COUNT(*) AS count FROM information_schema.tables
      WHERE table_schema = current_schema() AND table_name = 'UserFavorite'`),
    scalar(
      `SELECT COUNT(*) AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`,
    ),
  ]);
  const report = {
    sha: process.env.GITHUB_SHA ?? null,
    checkedAt: new Date().toISOString(),
    migrationCount,
    restaurantsWithoutOnePrimaryCuisine,
    usersWithoutOneFavoritesCollection,
    recommendedCollectionCount,
    legacyColumnCount,
    legacyTableCount,
    passed:
      migrationCount === 14 &&
      restaurantsWithoutOnePrimaryCuisine === 0 &&
      usersWithoutOneFavoritesCollection === 0 &&
      recommendedCollectionCount === 1 &&
      legacyColumnCount === 0 &&
      legacyTableCount === 0,
  };
  const outputPath = process.env.PHASE2_CONTRACT_REPORT_PATH;
  if (outputPath) {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
};

run().finally(() => prisma.$disconnect());
