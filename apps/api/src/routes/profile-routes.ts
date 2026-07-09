import type { FastifyInstance } from 'fastify';
import { requireAuthenticatedUser } from '../http/auth-guards.js';
import { prisma } from '../prisma.js';
import { sanitizeUser } from '../roles.js';
import { profileUpdateSchema } from '../schemas.js';

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
      if (body.username) {
        const existing = await prisma.user.findFirst({
          where: {
            username: body.username,
            NOT: { id: request.currentUser.id },
          },
        });
        if (existing) {
          return reply.code(409).send({ message: 'Username already taken' });
        }
      }
      const updated = await prisma.user.update({
        where: { id: request.currentUser.id },
        data: body,
      });
      return sanitizeUser(updated);
    },
  );
};
