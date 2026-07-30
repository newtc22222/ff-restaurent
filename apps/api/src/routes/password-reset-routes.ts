import { createHash } from 'node:crypto';

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import {
  requireAuthenticatedUser,
  requireRootAdmin,
} from '../http/auth-guards.js';
import {
  passwordResetConsumeSchema,
  passwordResetRequestSchema,
} from '../schemas/index.js';
import {
  consumePasswordReset,
  issueResetCode,
  listPendingResetRequests,
  rejectResetRequest,
  requestPasswordReset,
} from '../services/password-reset-service.js';

/**
 * Password recovery keeps public responses opaque and administration
 * ROOT_ADMIN-only. Recovery rules live in password-reset-service; this module
 * owns rate limiting, parsing, and status codes.
 */

const acceptedResponse = {
  ok: true,
  message: 'If the account exists, the request will be reviewed.',
};

/** Rate-limit per IP *and* identifier, so one attacker cannot cycle accounts. */
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

const invalidReset = (reply: FastifyReply) =>
  reply.code(400).send({
    code: 'PASSWORD_RESET_INVALID',
    message: 'The reset code is invalid or expired',
  });

const notFound = (reply: FastifyReply) =>
  reply
    .code(404)
    .send({ code: 'NOT_FOUND', message: 'Reset request not found' });

export const registerPasswordResetRoutes = (app: FastifyInstance) => {
  const publicRateLimit = {
    max: 5,
    timeWindow: '15 minutes',
    keyGenerator: identifierKey,
  };
  const rootAdmin = {
    preHandler: [requireAuthenticatedUser, requireRootAdmin],
  };

  app.post(
    '/auth/password-reset-requests',
    { config: { rateLimit: publicRateLimit } },
    async (request, reply) => {
      const parsed = passwordResetRequestSchema.safeParse(request.body);
      // A malformed body gets the same accepted response as a valid one.
      if (parsed.success) await requestPasswordReset(parsed.data.identifier);
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
      const outcome = await consumePasswordReset(body);
      if (outcome === 'invalid') return invalidReset(reply);
      return { ok: true };
    },
  );

  app.get('/admin/password-reset-requests', rootAdmin, async () =>
    listPendingResetRequests(),
  );

  app.post(
    '/admin/password-reset-requests/:id/issue',
    rootAdmin,
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await issueResetCode(id, request.currentUser.id);
      if (result.outcome === 'not-found') return notFound(reply);
      if (result.outcome === 'root-requires-operator') {
        return reply.code(403).send({
          code: 'ROOT_RESET_REQUIRES_OPERATOR',
          message: 'ROOT_ADMIN recovery requires the operator command',
        });
      }
      if (result.outcome === 'conflict') {
        return reply.code(409).send({
          code: 'PASSWORD_RESET_CONFLICT',
          message: 'Reset request changed',
        });
      }
      return { code: result.code, expiresInMinutes: result.expiresInMinutes };
    },
  );

  app.post(
    '/admin/password-reset-requests/:id/reject',
    rootAdmin,
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const rejected = await rejectResetRequest(id);
      if (!rejected) return notFound(reply);
      return { ok: true };
    },
  );
};
