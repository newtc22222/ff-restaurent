import { pathToFileURL } from 'node:url';
import { Prisma, PrismaClient, SystemRole } from '@prisma/client';

const prisma = new PrismaClient();

export const bootstrapRootAdmin = async (
  client: PrismaClient,
  configuredUsername = process.env.ROOT_ADMIN_USERNAME?.trim(),
) => {
  const existingRoot = await client.user.findFirst({
    where: { systemRole: SystemRole.ROOT_ADMIN },
    select: { id: true, username: true },
  });
  if (existingRoot) {
    return { status: 'existing' as const, user: existingRoot };
  }
  if (!configuredUsername) {
    throw new Error(
      'ROOT_ADMIN_USERNAME is required when the database has no ROOT_ADMIN',
    );
  }

  const candidate = await client.user.findUnique({
    where: { username: configuredUsername },
    select: { id: true, username: true },
  });
  if (!candidate) {
    throw new Error(
      `ROOT_ADMIN_USERNAME does not identify an existing user: ${configuredUsername}`,
    );
  }

  try {
    const promoted = await client.user.update({
      where: { id: candidate.id },
      data: {
        systemRole: SystemRole.ROOT_ADMIN,
        sessionVersion: { increment: 1 },
      },
      select: { id: true, username: true },
    });
    return { status: 'promoted' as const, user: promoted };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const winner = await client.user.findFirst({
        where: { systemRole: SystemRole.ROOT_ADMIN },
        select: { id: true, username: true },
      });
      if (winner) return { status: 'existing' as const, user: winner };
    }
    throw error;
  }
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  bootstrapRootAdmin(prisma)
    .then((result) => {
      console.info('ROOT_ADMIN bootstrap complete', {
        status: result.status,
        userId: result.user.id,
        username: result.user.username,
      });
    })
    .then(() => prisma.$disconnect())
    .catch(async (error) => {
      console.error(error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
