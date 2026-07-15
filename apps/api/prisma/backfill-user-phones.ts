import { pathToFileURL } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { planUserPhoneBackfill } from '../src/phone-backfill.js';

const prisma = new PrismaClient();

export const backfillUserPhones = async () => {
  const records = await prisma.user.findMany({
    where: { phone: { not: null } },
    select: { id: true, phone: true },
  });
  const plan = planUserPhoneBackfill(
    records.flatMap((record) =>
      record.phone ? [{ id: record.id, phone: record.phone }] : [],
    ),
  );

  if (plan.invalid.length || plan.collisions.length) {
    console.error('User phone backfill preflight failed', {
      invalid: plan.invalid,
      collisions: plan.collisions,
    });
    throw new Error(
      'User phones contain invalid values or canonical collisions; remediate the masked records before deployment.',
    );
  }

  if (plan.updates.length) {
    await prisma.$transaction(
      plan.updates.map((update) =>
        prisma.user.update({
          where: { id: update.id },
          data: { phone: update.phone },
        }),
      ),
    );
  }

  console.info('User phone backfill complete', {
    scanned: records.length,
    updated: plan.updates.length,
  });
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  backfillUserPhones()
    .then(() => prisma.$disconnect())
    .catch(async (error) => {
      console.error(error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
