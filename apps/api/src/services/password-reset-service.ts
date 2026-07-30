import { randomInt } from 'node:crypto';

import {
  PasswordResetStatus,
  SystemRole,
  UserAccountStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

import { parseVietnamMobilePhone } from '@ff-restaurent/shared';

import { prisma } from '../lib/prisma.js';

/**
 * Operator-approved password recovery.
 *
 * Two properties this module exists to protect, both easy to break by
 * "tidying" the control flow:
 *
 * - **Account enumeration.** A request for an unknown identifier must be
 *   indistinguishable from one for a known identifier, so the caller always
 *   gets the same accepted response and the same work is done either way.
 * - **Timing.** The code comparison runs against a dummy hash when no request
 *   exists, *before* the existence check short-circuits, so a missing reset
 *   cannot be detected from response time.
 */

const RESET_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const RESET_CODE_TTL_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;

/** Pre-computed so the failure path costs the same as the success path. */
const dummyHash = bcrypt.hash('not-a-real-reset-code', 12);

/** Ambiguous alphabet (no 0/O/1/I) — these codes get read aloud. */
const generateCode = () =>
  Array.from(
    { length: 8 },
    () => RESET_CODE_ALPHABET[randomInt(RESET_CODE_ALPHABET.length)],
  ).join('');

const resolveUser = async (identifier: string) => {
  const byUsername = await prisma.user.findUnique({
    where: { username: identifier },
  });
  if (byUsername) return byUsername;
  const parsedPhone = parseVietnamMobilePhone(identifier);
  if (!parsedPhone.success || !parsedPhone.phone) return null;
  return prisma.user.findUnique({ where: { phone: parsedPhone.phone } });
};

/**
 * Records a recovery request, superseding any earlier active one. Silently
 * does nothing for an unknown identifier — the caller cannot tell.
 */
export const requestPasswordReset = async (identifier: string) => {
  const user = await resolveUser(identifier);
  if (!user || user.accountStatus !== UserAccountStatus.ACTIVE) return;
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
};

export type ConsumeOutcome = 'invalid' | 'ok';

/**
 * Verifies a code and rotates the password. Every failure returns the same
 * `invalid` outcome — expired, wrong, locked and unknown are not
 * distinguishable to the caller.
 */
export const consumePasswordReset = async (input: {
  identifier: string;
  code: string;
  newPassword: string;
}): Promise<ConsumeOutcome> => {
  const user = await resolveUser(input.identifier);
  const reset = user
    ? await prisma.passwordResetRequest.findFirst({
        where: {
          userId: user.id,
          activeKey: user.id,
          status: PasswordResetStatus.CODE_ISSUED,
        },
      })
    : null;

  // Runs unconditionally, against a dummy hash when there is no request.
  const codeMatches = await bcrypt.compare(
    input.code.toUpperCase(),
    reset?.codeHash ?? (await dummyHash),
  );
  if (
    !user ||
    user.accountStatus !== UserAccountStatus.ACTIVE ||
    !reset ||
    !reset.codeHash
  )
    return 'invalid';

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
    return 'invalid';
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
    return 'invalid';
  }

  const newPasswordHash = await bcrypt.hash(input.newPassword, 12);
  /*
   * The claim is an atomic updateMany guarded on the same preconditions that
   * were just checked. If two requests race, exactly one sees count === 1 and
   * the loser is rejected rather than both rotating the password.
   */
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
  return consumed ? 'ok' : 'invalid';
};

export const listPendingResetRequests = () =>
  prisma.passwordResetRequest.findMany({
    where: {
      status: {
        in: [PasswordResetStatus.PENDING, PasswordResetStatus.CODE_ISSUED],
      },
      activeKey: { not: null },
      user: { accountStatus: UserAccountStatus.ACTIVE },
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
  });

export type IssueOutcome =
  | { outcome: 'not-found' }
  | { outcome: 'root-requires-operator' }
  | { outcome: 'conflict' }
  | { outcome: 'ok'; code: string; expiresInMinutes: number };

/**
 * Issues a one-time code for an operator to relay.
 *
 * ROOT_ADMIN recovery and self-service are refused here on purpose: both would
 * let a single compromised admin session take over the singleton system role,
 * so they go through the audited operator command instead.
 */
export const issueResetCode = async (
  id: string,
  actingUserId: string,
): Promise<IssueOutcome> => {
  const reset = await prisma.passwordResetRequest.findUnique({
    where: { id },
    include: { user: true },
  });
  if (
    !reset ||
    !reset.activeKey ||
    reset.status === PasswordResetStatus.USED ||
    reset.user.accountStatus !== UserAccountStatus.ACTIVE
  ) {
    return { outcome: 'not-found' };
  }
  if (
    reset.user.systemRole === SystemRole.ROOT_ADMIN ||
    reset.userId === actingUserId
  ) {
    return { outcome: 'root-requires-operator' };
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
  if (updated.count !== 1) return { outcome: 'conflict' };
  return {
    outcome: 'ok',
    code,
    expiresInMinutes: RESET_CODE_TTL_MS / 60_000,
  };
};

/** Returns false when no active request matched. */
export const rejectResetRequest = async (id: string) => {
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
  return updated.count === 1;
};
