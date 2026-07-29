import { buildApp } from './app.js';
import { resolveServerAddress } from './config/server-config.js';
import { prisma } from './lib/prisma.js';

const { port, host } = resolveServerAddress();

const app = await buildApp();

const shutdown = async () => {
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ port, host });
