import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma } from '../prisma.js';
import { sanitizeUser } from '../roles.js';
import { loginSchema, registerSchema } from '../schemas.js';

/**
 * Authentication routes issue JWTs and return sanitized user profiles.
 */
export const registerAuthRoutes = (app: FastifyInstance) => {
  app.post('/auth/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username: body.identifier }, { phone: body.identifier }],
      },
    });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      return reply.code(401).send({ message: 'Invalid credentials' });
    }
    return {
      token: app.jwt.sign({ sub: user.id }),
      user: sanitizeUser(user),
    };
  });

  app.post('/auth/register', async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { username: body.username },
          ...(body.phone ? [{ phone: body.phone }] : []),
        ],
      },
    });
    if (existing) {
      return reply
        .code(409)
        .send({ message: 'Username or phone already taken' });
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
  });
};
