import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { runPhase2Backfill } from '../src/phase2-backfill.js';

const prisma = new PrismaClient();

export const backfillPhase2 = async () => {
  const dryRun = process.env.PHASE2_BACKFILL_DRY_RUN === '1';
  const batchSize = Number.parseInt(
    process.env.PHASE2_BACKFILL_BATCH_SIZE ?? '100',
    10,
  );
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000) {
    throw new Error('PHASE2_BACKFILL_BATCH_SIZE must be between 1 and 1000');
  }
  const report = await runPhase2Backfill({
    client: prisma,
    dryRun,
    batchSize,
    log: (event) => console.info(JSON.stringify(event)),
  });
  const reportPath = resolve(
    process.env.PHASE2_BACKFILL_REPORT_PATH ??
      `phase2-backfill-report-${Date.now()}.json`,
  );
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.info(`Phase 2 backfill report written to ${reportPath}`);
  if (!dryRun && !report.verification.passed) {
    throw new Error('Phase 2 backfill verification failed');
  }
  return report;
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  backfillPhase2()
    .then(() => prisma.$disconnect())
    .catch(async (error) => {
      console.error(error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
