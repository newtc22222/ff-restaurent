import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../prisma.js';
import { isHeadChef, isRootAdmin, isSousChefOrAbove } from '../roles.js';

type JwtPayload = { sub: string; ver?: number };

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
      reply.code(401).send({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'User no longer exists',
      });
      return;
    }
    if ((payload.ver ?? 0) !== user.sessionVersion) {
      reply.code(401).send({
        code: 'SESSION_INVALIDATED',
        message: 'This session is no longer valid',
      });
      return;
    }
    request.currentUser = {
      id: user.id,
      username: user.username,
      name: user.name,
      chefRole: user.chefRole,
      systemRole: user.systemRole,
    };
  } catch {
    if (!reply.sent) {
      reply.code(401).send({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required',
      });
    }
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
 * Allows HEAD_CHEF and the inherited ROOT_ADMIN for global content actions.
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

/** Allows only the singleton ROOT_ADMIN to access system administration. */
export const requireRootAdmin = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  if (!isRootAdmin(request.currentUser)) {
    reply.code(403).send({
      code: 'ROOT_ADMIN_REQUIRED',
      message: 'ROOT_ADMIN required',
    });
  }
};
