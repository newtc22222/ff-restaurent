import {
  PasswordResetStatus,
  Prisma,
  SystemRole,
  type User,
  UserAccountStatus,
} from '@prisma/client';

import { forbidden, notFound } from '../http/app-error.js';
import { prisma } from '../lib/prisma.js';

type AccountStatusDb = Pick<typeof prisma, '$transaction'>;

export const updateUserAccountStatus = async (
  {
    actorId,
    targetId,
    accountStatus,
  }: {
    actorId: string;
    targetId: string;
    accountStatus: UserAccountStatus;
  },
  db: AccountStatusDb = prisma,
): Promise<{ user: User; changed: boolean }> =>
  db.$transaction(
    async (tx) => {
      const [actor, target] = await Promise.all([
        tx.user.findUnique({ where: { id: actorId } }),
        tx.user.findUnique({ where: { id: targetId } }),
      ]);
      if (!actor || actor.systemRole !== SystemRole.ROOT_ADMIN) {
        throw forbidden('ROOT_ADMIN_REQUIRED', 'ROOT_ADMIN required');
      }
      if (!target) throw notFound('NOT_FOUND', 'User not found');
      if (
        target.id === actor.id ||
        target.systemRole === SystemRole.ROOT_ADMIN
      ) {
        throw forbidden(
          'ROOT_ADMIN_ACCOUNT_STATUS_FORBIDDEN',
          'The ROOT_ADMIN account cannot be blocked or restored here',
        );
      }
      if (target.accountStatus === accountStatus) {
        return { user: target, changed: false };
      }

      const updated = await tx.user.update({
        where: { id: target.id },
        data: {
          accountStatus,
          sessionVersion: { increment: 1 },
        },
      });
      if (accountStatus === UserAccountStatus.BLOCKED) {
        await tx.passwordResetRequest.updateMany({
          where: { userId: target.id, activeKey: target.id },
          data: {
            activeKey: null,
            codeHash: null,
            status: PasswordResetStatus.SUPERSEDED,
            resolvedAt: new Date(),
          },
        });
      }
      await tx.userAccountStatusAudit.create({
        data: {
          userId: target.id,
          changedById: actor.id,
          fromStatus: target.accountStatus,
          toStatus: updated.accountStatus,
        },
      });
      return { user: updated, changed: true };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
