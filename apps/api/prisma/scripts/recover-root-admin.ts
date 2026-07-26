import bcrypt from 'bcryptjs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { PrismaClient, SystemRole } from '@prisma/client';

if (!stdin.isTTY || !stdout.isTTY) {
  throw new Error(
    'ROOT_ADMIN recovery must be run from an interactive terminal',
  );
}

const prisma = new PrismaClient();
const prompt = createInterface({ input: stdin, output: stdout });

const readSecret = (label: string) =>
  new Promise<string>((resolve, reject) => {
    let value = '';
    const previousRawMode = stdin.isRaw;
    const finish = (error?: Error) => {
      stdin.off('data', onData);
      stdin.setRawMode(previousRawMode);
      stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk: Buffer) => {
      for (const character of chunk.toString('utf8')) {
        if (character === '\r' || character === '\n') return finish();
        if (character === '\u0003')
          return finish(new Error('Recovery canceled by operator'));
        if (character === '\u007f' || character === '\b') {
          value = value.slice(0, -1);
        } else if (character >= ' ') {
          value += character;
        }
      }
    };
    stdout.write(label);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
  });

try {
  const roots = await prisma.user.findMany({
    where: { systemRole: SystemRole.ROOT_ADMIN },
    select: { id: true, username: true },
    take: 2,
  });
  if (roots.length !== 1) {
    throw new Error(`Expected exactly one ROOT_ADMIN; found ${roots.length}`);
  }
  const root = roots[0];
  const confirmation = (
    await prompt.question(
      `Type the ROOT_ADMIN username (${root.username}) to continue: `,
    )
  ).trim();
  if (confirmation !== root.username) {
    throw new Error('ROOT_ADMIN username confirmation did not match');
  }
  prompt.close();
  const password = await readSecret('New password (8-128 characters): ');
  const repeated = await readSecret('Repeat new password: ');
  if (password.length < 8 || password.length > 128) {
    throw new Error('Password must be between 8 and 128 characters');
  }
  if (password !== repeated) throw new Error('Passwords did not match');

  await prisma.user.update({
    where: { id: root.id },
    data: {
      passwordHash: await bcrypt.hash(password, 12),
      sessionVersion: { increment: 1 },
    },
  });
  console.info('ROOT_ADMIN password reset; all existing sessions are invalid');
} finally {
  prompt.close();
  await prisma.$disconnect();
}
