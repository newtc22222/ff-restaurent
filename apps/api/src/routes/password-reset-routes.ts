import { createHash, randomInt } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { PasswordResetStatus, SystemRole } from '@prisma/client';
import { parseVietnamMobilePhone } from '@ff-restaurent/shared';
import bcrypt from 'bcryptjs';
import {
  requireAuthenticatedUser,
  requireRootAdmin,
} from '../http/auth-guards.js';
import { prisma } from '../prisma.js';
import {
  passwordResetConsumeSchema,
  passwordResetRequestSchema,
} from '../schemas.js';

const RESET_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const RESET_CODE_TTL_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const acceptedResponse = {
  ok: true,
  message: 'If the account exists, the request will be reviewed.',
};
const dummyHash = bcrypt.hash('not-a-real-reset-code', 12);

const identifierKey = (request: FastifyRequest) => {
  const identifier =
    typeof request.body === 'object' &&
    request.body !== null &&
    'identifier' in request.body
      ? String((request.body as { identifier?: unknown }).identifier ?? '')
          .trim()
          .toLowerCase()
      : '';
  return `${request.ip}:${createHash('sha256').update(identifier).digest('hex')}`;
};

const resolveUser = async (identifier: string) => {
  const byUsername = await prisma.user.findUnique({
    where: { username: identifier },
  });
  if (byUsername) return byUsername;
  const parsedPhone = parseVietnamMobilePhone(identifier);
  if (!parsedPhone.success || !parsedPhone.phone) return null;
  return prisma.user.findUnique({ where: { phone: parsedPhone.phone } });
};

const generateCode = () =>
  Array.from(
    { length: 8 },
    () => RESET_CODE_ALPHABET[randomInt(RESET_CODE_ALPHABET.length)],
  ).join('');

const invalidReset = (reply: FastifyReply) =>
  reply.code(400).send({
    code: 'PASSWORD_RESET_INVALID',
    message: 'The reset code is invalid or expired',
  });

/** Password recovery keeps public responses opaque and administration ROOT_ADMIN-only. */
export const registerPasswordResetRoutes = (app: FastifyInstance) => {
  const publicRateLimit = {
    max: 5,
    timeWindow: '15 minutes',
    keyGenerator: identifierKey,
  };

  app.post(
    '/auth/password-reset-requests',
    { config: { rateLimit: publicRateLimit } },
    async (request, reply) => {
      const parsed = passwordResetRequestSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(202).send(acceptedResponse);
      const user = await resolveUser(parsed.data.identifier);
      if (user) {
        try {
          await prisma.$transaction(async (tx) => {
            await tx.passwordResetRequest.updateMany({
              where: { userId: user.id, activeKey: user.id },
              data: {
                activeKey: null,
                codeHash: null,
                status: PasswordResetStatus.SUPERSEDED,
                resolvedAt: new Date(),
              },
            });
            await tx.passwordResetRequest.create({
              data: { userId: user.id, activeKey: user.id },
            });
          });
        } catch {
          // Preserve the enumeration-safe contract even if concurrent requests race.
        }
      }
      return reply.code(202).send(acceptedResponse);
    },
  );

  app.post(
    '/auth/password-reset',
    { config: { rateLimit: publicRateLimit } },
    async (request, reply) => {
      const body = passwordResetConsumeSchema.parse(request.body);
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

      const user = await resolveUser(body.identifier);
      const reset = user
        ? await prisma.passwordResetRequest.findFirst({
            where: {
              userId: user.id,
              activeKey: user.id,
              status: PasswordResetStatus.CODE_ISSUED,
            },
          })
        : null;
      const codeMatches = await bcrypt.compare(
        body.code.toUpperCase(),
        reset?.codeHash ?? (await dummyHash),
      );
      if (!user || !reset || !reset.codeHash) return invalidReset(reply);

      if (!reset.expiresAt || reset.expiresAt <= new Date()) {
        await prisma.passwordResetRequest.updateMany({
          where: { id: reset.id, activeKey: user.id },
          data: {
            activeKey: null,
            codeHash: null,
            status: PasswordResetStatus.EXPIRED,
            resolvedAt: new Date(),
          },
        });
        return invalidReset(reply);
      }

      if (!codeMatches) {
        const failedAttempts = reset.failedAttempts + 1;
        await prisma.passwordResetRequest.updateMany({
          where: {
            id: reset.id,
            activeKey: user.id,
            status: PasswordResetStatus.CODE_ISSUED,
            failedAttempts: { lt: MAX_FAILED_ATTEMPTS },
          },
          data: {
            failedAttempts: { increment: 1 },
            ...(failedAttempts >= MAX_FAILED_ATTEMPTS
              ? {
                  activeKey: null,
                  codeHash: null,
                  status: PasswordResetStatus.LOCKED,
                  resolvedAt: new Date(),
                }
              : {}),
          },
        });
        return invalidReset(reply);
      }

      const newPasswordHash = await bcrypt.hash(body.newPassword, 12);
      const consumed = await prisma.$transaction(async (tx) => {
        const claim = await tx.passwordResetRequest.updateMany({
          where: {
            id: reset.id,
            activeKey: user.id,
            status: PasswordResetStatus.CODE_ISSUED,
            expiresAt: { gt: new Date() },
            failedAttempts: { lt: MAX_FAILED_ATTEMPTS },
          },
          data: {
            activeKey: null,
            codeHash: null,
            status: PasswordResetStatus.USED,
            resolvedAt: new Date(),
          },
        });
        if (claim.count !== 1) return false;
        await tx.user.update({
          where: { id: user.id },
          data: {
            passwordHash: newPasswordHash,
            sessionVersion: { increment: 1 },
          },
        });
        return true;
      });
      if (!consumed) return invalidReset(reply);
      return { ok: true };
    },
  );

  app.get(
    '/admin/password-reset-requests',
    { preHandler: [requireAuthenticatedUser, requireRootAdmin] },
    async () =>
      prisma.passwordResetRequest.findMany({
        where: {
          status: {
            in: [PasswordResetStatus.PENDING, PasswordResetStatus.CODE_ISSUED],
          },
          activeKey: { not: null },
        },
        select: {
          id: true,
          status: true,
          expiresAt: true,
          failedAttempts: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              username: true,
              name: true,
              phone: true,
              systemRole: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
  );

  app.post(
    '/admin/password-reset-requests/:id/issue',
    { preHandler: [requireAuthenticatedUser, requireRootAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const reset = await prisma.passwordResetRequest.findUnique({
        where: { id },
        include: { user: true },
      });
      if (
        !reset ||
        !reset.activeKey ||
        reset.status === PasswordResetStatus.USED
      ) {
        return reply
          .code(404)
          .send({ code: 'NOT_FOUND', message: 'Reset request not found' });
      }
      if (
        reset.user.systemRole === SystemRole.ROOT_ADMIN ||
        reset.userId === request.currentUser.id
      ) {
        return reply.code(403).send({
          code: 'ROOT_RESET_REQUIRES_OPERATOR',
          message: 'ROOT_ADMIN recovery requires the operator command',
        });
      }
      const code = generateCode();
      const updated = await prisma.passwordResetRequest.updateMany({
        where: {
          id,
          activeKey: reset.userId,
          status: {
            in: [PasswordResetStatus.PENDING, PasswordResetStatus.CODE_ISSUED],
          },
        },
        data: {
          codeHash: await bcrypt.hash(code, 12),
          expiresAt: new Date(Date.now() + RESET_CODE_TTL_MS),
          failedAttempts: 0,
          status: PasswordResetStatus.CODE_ISSUED,
        },
      });
      if (updated.count !== 1) {
        return reply.code(409).send({
          code: 'PASSWORD_RESET_CONFLICT',
          message: 'Reset request changed',
        });
      }
      return { code, expiresInMinutes: 15 };
    },
  );

  app.post(
    '/admin/password-reset-requests/:id/reject',
    { preHandler: [requireAuthenticatedUser, requireRootAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const updated = await prisma.passwordResetRequest.updateMany({
        where: {
          id,
          activeKey: { not: null },
          status: {
            in: [PasswordResetStatus.PENDING, PasswordResetStatus.CODE_ISSUED],
          },
        },
        data: {
          activeKey: null,
          codeHash: null,
          status: PasswordResetStatus.REJECTED,
          resolvedAt: new Date(),
        },
      });
      if (updated.count !== 1) {
        return reply
          .code(404)
          .send({ code: 'NOT_FOUND', message: 'Reset request not found' });
      }
      return { ok: true };
    },
  );
};
