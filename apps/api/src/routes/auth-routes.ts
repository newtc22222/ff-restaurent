import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { loadConfig } from '../config.js';
import { prisma } from '../prisma.js';
import { sanitizeUser } from '../roles.js';
import { loginSchema, registerSchema } from '../schemas.js';

/**
 * Authentication routes issue JWTs and return sanitized user profiles.
 */
export const registerAuthRoutes = (app: FastifyInstance) => {
  const authRateLimit = { max: 5, timeWindow: '1 minute' };

  app.post(
    '/auth/login',
    { config: { rateLimit: authRateLimit } },
    async (request, reply) => {
      const body = loginSchema.parse(request.body);
      const user = await prisma.user.findFirst({
        where: {
          OR: [{ username: body.identifier }, { phone: body.identifier }],
        },
      });
      if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
        return reply
          .code(401)
          .send({
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid credentials',
          });
      }
      request.log.info({ event: 'login_succeeded', userId: user.id });
      return {
        token: app.jwt.sign({ sub: user.id }),
        user: sanitizeUser(user),
      };
    },
  );

  app.post(
    '/auth/register',
    { config: { rateLimit: authRateLimit } },
    async (request, reply) => {
      const body = registerSchema.parse(request.body);
      if (body.inviteCode !== loadConfig().registrationInviteCode) {
        return reply.code(403).send({
          code: 'REGISTRATION_NOT_AUTHORIZED',
          message: 'Registration is not authorized',
        });
      }
      const existing = await prisma.user.findFirst({
        where: {
          OR: [
            { username: body.username },
            ...(body.phone ? [{ phone: body.phone }] : []),
          ],
        },
      });
      if (existing) {
        return reply.code(409).send({
          code: 'IDENTIFIER_TAKEN',
          message: 'Username or phone already taken',
        });
      }
      const user = await prisma.user.create({
        data: {
          name: body.name,
          username: body.username,
          phone: body.phone ?? null,
          passwordHash: await bcrypt.hash(body.password, 12),
        },
      });
      return reply.code(201).send({
        token: app.jwt.sign({ sub: user.id }),
        user: sanitizeUser(user),
      });
    },
  );
};
