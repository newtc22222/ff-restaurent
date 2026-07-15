import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const expectedIndexes = [
  'Notification_userId_createdAt_id_idx',
  'Notification_userId_readAt_idx',
  'Notification_billId_userId_createdAt_idx',
  'BillAuditLog_billId_createdAt_id_idx',
] as const;

const queryShapes = [
  {
    name: 'notification timeline',
    index: expectedIndexes[0],
    sql: `SELECT "id" FROM "Notification"
      WHERE "userId" = 'ff27-user'
      ORDER BY "createdAt" DESC, "id" DESC
      LIMIT 50`,
  },
  {
    name: 'unread notification update',
    index: expectedIndexes[1],
    sql: `SELECT "id" FROM "Notification"
      WHERE "userId" = 'ff27-user' AND "readAt" IS NULL`,
  },
  {
    name: 'reminder cooldown lookup',
    index: expectedIndexes[2],
    sql: `SELECT "userId" FROM "Notification"
      WHERE "billId" = 'ff27-bill'
        AND "userId" IN ('ff27-user')
        AND "createdAt" >= NOW() - INTERVAL '1 hour'`,
  },
  {
    name: 'bill activity history',
    index: expectedIndexes[3],
    sql: `SELECT "id" FROM "BillAuditLog"
      WHERE "billId" = 'ff27-bill'
      ORDER BY "createdAt", "id"`,
  },
] as const;

try {
  const rows = await prisma.$queryRaw<Array<{ indexname: string }>>`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = current_schema()
      AND indexname IN (${expectedIndexes[0]}, ${expectedIndexes[1]}, ${expectedIndexes[2]}, ${expectedIndexes[3]})
  `;
  const installed = new Set(rows.map(({ indexname }) => indexname));
  const missing = expectedIndexes.filter((index) => !installed.has(index));
  if (missing.length > 0) {
    throw new Error(`Missing FF-27 indexes: ${missing.join(', ')}`);
  }

  await prisma.$executeRawUnsafe('SET enable_seqscan = off');
  for (const query of queryShapes) {
    const planRows = await prisma.$queryRawUnsafe<
      Array<{ 'QUERY PLAN': unknown }>
    >(`EXPLAIN (FORMAT JSON) ${query.sql}`);
    const plan = JSON.stringify(planRows);
    if (!plan.includes(query.index)) {
      throw new Error(`${query.name} did not use ${query.index}: ${plan}`);
    }
    console.log(`${query.name}: ${query.index}`);
  }
  console.log(
    `FF-27 index coverage: ${queryShapes.length}/${queryShapes.length}`,
  );
} finally {
  await prisma.$disconnect();
}
