import { PrismaClient } from '@prisma/client';
import { disconnectSeedPrisma, seed } from './seed.js';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Automatic demo seeding is disabled in production');
}

const prisma = new PrismaClient();

const count = await prisma.user.count();
await prisma.$disconnect();

if (count === 0) {
  await seed({ reset: false });
}

await disconnectSeedPrisma();
