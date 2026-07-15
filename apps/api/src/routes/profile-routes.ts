import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { requireAuthenticatedUser } from '../http/auth-guards.js';
import { prisma } from '../prisma.js';
import { sanitizeUser } from '../roles.js';
import { passwordChangeSchema, profileUpdateSchema } from '../schemas.js';

/**
 * Profile routes expose and update the current authenticated user's account.
 */
export const registerProfileRoutes = (app: FastifyInstance) => {
  app.get('/me', { preHandler: requireAuthenticatedUser }, async (request) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: request.currentUser.id },
    });
    return sanitizeUser(user);
  });

  app.put(
    '/me/profile',
    { preHandler: requireAuthenticatedUser },
    async (request, reply) => {
      const body = profileUpdateSchema.parse(request.body);
      if (body.username || body.phone) {
        const existing = await prisma.user.findFirst({
          where: {
            OR: [
              ...(body.username ? [{ username: body.username }] : []),
              ...(body.phone ? [{ phone: body.phone }] : []),
            ],
            NOT: { id: request.currentUser.id },
          },
        });
        if (existing) {
          return reply.code(409).send({
            code: 'IDENTIFIER_TAKEN',
            message: 'Username or phone already taken',
          });
        }
      }
      const updated = await prisma.user.update({
        where: { id: request.currentUser.id },
        data: body,
      });
      return sanitizeUser(updated);
    },
  );

  app.patch(
    '/me/password',
    { preHandler: requireAuthenticatedUser },
    async (request, reply) => {
      const body = passwordChangeSchema.parse(request.body);
      if (body.newPassword.length < 8 || body.newPassword.length > 128) {
        return reply.code(400).send({
          code: 'PASSWORD_LENGTH_INVALID',
          message: 'New password must be between 8 and 128 characters',
        });
      }
      if (body.newPassword !== body.confirmation) {
        return reply.code(400).send({
          code: 'PASSWORD_CONFIRMATION_MISMATCH',
          message: 'Password confirmation does not match',
        });
      }

      const user = await prisma.user.findUniqueOrThrow({
        where: { id: request.currentUser.id },
      });
      if (!(await bcrypt.compare(body.currentPassword, user.passwordHash))) {
        return reply.code(403).send({
          code: 'CURRENT_PASSWORD_INVALID',
          message: 'Current password is incorrect',
        });
      }
      if (await bcrypt.compare(body.newPassword, user.passwordHash)) {
        return reply.code(409).send({
          code: 'PASSWORD_REUSE_FORBIDDEN',
          message: 'New password must differ from the current password',
        });
      }

      const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await bcrypt.hash(body.newPassword, 12),
          sessionVersion: { increment: 1 },
        },
        select: { id: true, sessionVersion: true },
      });
      return {
        token: app.jwt.sign({
          sub: updated.id,
          ver: updated.sessionVersion,
        }),
      };
    },
  );
};
