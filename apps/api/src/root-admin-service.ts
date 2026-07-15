import bcrypt from 'bcryptjs';
import { Prisma, SystemRole } from '@prisma/client';
import { prisma } from './prisma.js';

export class RootAdminTransferError extends Error {
  constructor(
    readonly code:
      | 'ROOT_ADMIN_REQUIRED'
      | 'ROOT_TRANSFER_PASSWORD_INVALID'
      | 'ROOT_TRANSFER_CONFIRMATION_MISMATCH'
      | 'ROOT_TRANSFER_TARGET_INVALID'
      | 'ROOT_TRANSFER_CONFLICT',
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'RootAdminTransferError';
  }
}

export const transferRootAdmin = async ({
  currentUserId,
  currentPassword,
  targetUsername,
  confirmationUsername,
}: {
  currentUserId: string;
  currentPassword: string;
  targetUsername: string;
  confirmationUsername: string;
}) => {
  if (targetUsername !== confirmationUsername) {
    throw new RootAdminTransferError(
      'ROOT_TRANSFER_CONFIRMATION_MISMATCH',
      400,
      'Target username confirmation does not match',
    );
  }

  const current = await prisma.user.findUnique({
    where: { id: currentUserId },
  });
  if (!current || current.systemRole !== SystemRole.ROOT_ADMIN) {
    throw new RootAdminTransferError(
      'ROOT_ADMIN_REQUIRED',
      403,
      'ROOT_ADMIN required',
    );
  }
  if (!(await bcrypt.compare(currentPassword, current.passwordHash))) {
    throw new RootAdminTransferError(
      'ROOT_TRANSFER_PASSWORD_INVALID',
      403,
      'Current password is incorrect',
    );
  }
  if (current.username === targetUsername) {
    throw new RootAdminTransferError(
      'ROOT_TRANSFER_TARGET_INVALID',
      400,
      'Choose another existing user',
    );
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        const target = await tx.user.findUnique({
          where: { username: targetUsername },
        });
        if (!target || target.systemRole === SystemRole.ROOT_ADMIN) {
          throw new RootAdminTransferError(
            'ROOT_TRANSFER_TARGET_INVALID',
            400,
            'Choose another existing user',
          );
        }

        const released = await tx.user.updateMany({
          where: {
            id: currentUserId,
            systemRole: SystemRole.ROOT_ADMIN,
          },
          data: {
            systemRole: null,
            sessionVersion: { increment: 1 },
          },
        });
        if (released.count !== 1) {
          throw new RootAdminTransferError(
            'ROOT_TRANSFER_CONFLICT',
            409,
            'Root ownership changed before this request completed',
          );
        }

        await tx.user.update({
          where: { id: target.id },
          data: {
            systemRole: SystemRole.ROOT_ADMIN,
            sessionVersion: { increment: 1 },
          },
        });
        const audit = await tx.rootAdminTransferAudit.create({
          data: { fromUserId: currentUserId, toUserId: target.id },
        });
        return { auditId: audit.id, targetUserId: target.id };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (error instanceof RootAdminTransferError) throw error;
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ['P2002', 'P2034'].includes(error.code)
    ) {
      throw new RootAdminTransferError(
        'ROOT_TRANSFER_CONFLICT',
        409,
        'Root ownership changed before this request completed',
      );
    }
    throw error;
  }
};
