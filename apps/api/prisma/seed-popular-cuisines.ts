import { PrismaClient } from '@prisma/client';
import { seedPopularVietnamCuisines } from '../src/popular-cuisine-seed.js';

const prisma = new PrismaClient();

try {
  const result = await seedPopularVietnamCuisines(prisma);
  console.info(
    JSON.stringify({ event: 'popular_cuisine_seed_completed', ...result }),
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
