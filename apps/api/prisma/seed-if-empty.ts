import { PrismaClient } from '@prisma/client';
import { disconnectSeedPrisma, seed } from './seed.js';

const prisma = new PrismaClient();

const count = await prisma.user.count();
await prisma.$disconnect();

if (count === 0) {
  await seed({ reset: false });
}

await disconnectSeedPrisma();
