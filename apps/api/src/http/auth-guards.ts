import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../prisma.js';
import { isHeadChef, isSousChefOrAbove } from '../roles.js';

type JwtPayload = { sub: string };

/**
 * Verifies the bearer token and stores the minimal user identity needed by
 * downstream permission checks on request.currentUser.
 */
export const requireAuthenticatedUser = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  try {
    await request.jwtVerify();
    const payload = request.user as JwtPayload;
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      reply.code(401).send({ message: 'User no longer exists' });
      return;
    }
    request.currentUser = {
      id: user.id,
      username: user.username,
      name: user.name,
      chefRole: user.chefRole,
    };
  } catch {
    reply.code(401).send({ message: 'Authentication required' });
  }
};

/**
 * Allows bill and restaurant managers while keeping customer-only users out.
 * This guard must run after requireAuthenticatedUser.
 */
export const requireSousChefOrHeadChef = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  if (!isSousChefOrAbove(request.currentUser)) {
    reply.code(403).send({ message: 'SOUS_CHEF or HEAD_CHEF required' });
  }
};

/**
 * Allows only HEAD_CHEF users for administrative actions.
 * This guard must run after requireAuthenticatedUser.
 */
export const requireHeadChef = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  if (!isHeadChef(request.currentUser)) {
    reply.code(403).send({ message: 'HEAD_CHEF required' });
  }
};
