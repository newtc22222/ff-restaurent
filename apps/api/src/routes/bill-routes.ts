import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { createHash } from 'node:crypto';
import { EntryStatus, PaymentStatus, Prisma } from '@prisma/client';
import { calculateBillSplit } from '@ff-restaurent/shared';
import {
  requireAuthenticatedUser,
  requireHeadChef,
  requireSousChefOrHeadChef,
} from '../http/auth-guards.js';
import { prisma } from '../prisma.js';
import { isHeadChef, isSousChefOrAbove, publicUserSelect } from '../roles.js';
import {
  billListQuerySchema,
  billSchema,
  paymentStatusSchema,
} from '../schemas.js';
import {
  type PublicRestaurantRecord,
  publicRestaurantSelect,
  serializePublicRestaurant,
} from '../restaurant-contract.js';
import { pageResult } from '../pagination.js';

const REMINDER_COOLDOWN_MS = 15 * 60 * 1000;

export const billResponseInclude = {
  restaurant: { select: publicRestaurantSelect },
  createdBy: { select: publicUserSelect },
  participants: {
    include: { member: { select: publicUserSelect } },
    orderBy: { member: { name: 'asc' as const } },
  },
};

export const paymentResponseInclude = {
  member: { select: publicUserSelect },
  bill: true,
};

const serializeBillResponse = <
  T extends { restaurant: PublicRestaurantRecord },
>(
  bill: T,
  userId: string,
) => ({
  ...bill,
  restaurant: serializePublicRestaurant(bill.restaurant, userId),
});

export const billActivityActorSelect = {
  id: true,
  username: true,
  name: true,
} satisfies Prisma.UserSelect;

type BillActivityActor = Prisma.UserGetPayload<{
  select: typeof billActivityActorSelect;
}>;

type BillActivityDetails = {
  changes?: string[];
  memberId?: string;
  memberName?: string;
  fromStatus?: string;
  toStatus?: string;
  sent?: number;
  skipped?: number;
};

type BillActivitySource = {
  id: string;
  createdAt: Date;
  createdBy: BillActivityActor;
  participants: Array<{ memberId: string; member: BillActivityActor }>;
  auditLogs: Array<{
    id: string;
    action: string;
    before: Prisma.JsonValue | null;
    after: Prisma.JsonValue | null;
    createdAt: Date;
    user: BillActivityActor;
  }>;
};

const isJsonObject = (
  value: Prisma.JsonValue | null,
): value is Prisma.JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const valueChanged = (before: unknown, after: unknown) =>
  JSON.stringify(before) !== JSON.stringify(after);

const updatedFields = (
  before: Prisma.JsonValue | null,
  after: Prisma.JsonValue | null,
) => {
  if (!isJsonObject(before) || !isJsonObject(after)) return [];
  const changes = new Set<string>();
  if (valueChanged(before.restaurantId, after.restaurantId))
    changes.add('restaurant');
  if (
    ['baseCost', 'vat', 'shippingFee', 'totalCost'].some((field) =>
      valueChanged(before[field], after[field]),
    )
  )
    changes.add('costs');
  if (
    valueChanged(before.discounts, after.discounts) ||
    valueChanged(before.vouchers, after.vouchers)
  )
    changes.add('adjustments');
  if (valueChanged(before.paymentUrl, after.paymentUrl))
    changes.add('paymentLink');
  if (valueChanged(before.participants, after.participants))
    changes.add('participants');
  return [...changes];
};

const activityDetails = (
  log: BillActivitySource['auditLogs'][number],
  participantNames: Map<string, string>,
): BillActivityDetails | undefined => {
  if (log.action === 'UPDATED') {
    return { changes: updatedFields(log.before, log.after) };
  }
  if (log.action === 'PAYMENT_STATUS_CHANGED' && isJsonObject(log.after)) {
    const before = isJsonObject(log.before) ? log.before : {};
    const memberId =
      typeof log.after.memberId === 'string' ? log.after.memberId : undefined;
    return {
      memberId,
      memberName: memberId ? participantNames.get(memberId) : undefined,
      fromStatus:
        typeof before.paymentStatus === 'string'
          ? before.paymentStatus
          : undefined,
      toStatus:
        typeof log.after.paymentStatus === 'string'
          ? log.after.paymentStatus
          : undefined,
    };
  }
  if (log.action === 'REMINDERS_SENT' && isJsonObject(log.after)) {
    return {
      sent: typeof log.after.sent === 'number' ? log.after.sent : 0,
      skipped: typeof log.after.skipped === 'number' ? log.after.skipped : 0,
    };
  }
  return undefined;
};

const visibleActivityActions = new Set([
  'UPDATED',
  'PAYMENT_STATUS_CHANGED',
  'REMINDERS_SENT',
  'ARCHIVED',
  'RESTORED',
]);

export const buildBillActivityTimeline = (bill: BillActivitySource) => {
  const participantNames = new Map(
    bill.participants.map((participant) => [
      participant.memberId,
      participant.member.name,
    ]),
  );
  const events = bill.auditLogs
    .filter((log) => visibleActivityActions.has(log.action))
    .map((log) => ({
      id: log.id,
      action: log.action,
      actor: log.user,
      details: activityDetails(log, participantNames),
      createdAt: log.createdAt,
    }));
  events.push({
    id: `created-${bill.id}`,
    action: 'CREATED',
    actor: bill.createdBy,
    details: undefined,
    createdAt: bill.createdAt,
  });
  return events.sort(
    (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
  );
};

const canManageBill = (
  bill: { createdById: string },
  request: FastifyRequest,
) =>
  isHeadChef(request.currentUser) ||
  bill.createdById === request.currentUser.id;

const canViewBill = (
  bill: { createdById: string; participants: Array<{ memberId: string }> },
  request: FastifyRequest,
) =>
  isHeadChef(request.currentUser) ||
  bill.createdById === request.currentUser.id ||
  bill.participants.some(
    (participant) => participant.memberId === request.currentUser.id,
  );

type FingerprintBill = {
  restaurantId: string;
  baseCost: number;
  vat: number;
  shippingFee: number;
  paymentUrl?: string | null;
  discounts?: unknown[];
  vouchers?: unknown[];
  participants: Array<{ memberId: string; originCost?: number }>;
};

export const createBillFingerprint = (bill: FingerprintBill) => {
  const canonical = {
    restaurantId: bill.restaurantId,
    baseCost: bill.baseCost,
    vat: bill.vat,
    shippingFee: bill.shippingFee,
    paymentUrl: bill.paymentUrl ?? null,
    discounts: [...(bill.discounts ?? [])].sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right)),
    ),
    vouchers: [...(bill.vouchers ?? [])].sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right)),
    ),
    participants: bill.participants
      .map(({ memberId, originCost }) => ({ memberId, originCost }))
      .sort((left, right) => left.memberId.localeCompare(right.memberId)),
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
};

const computeBillCreateData = (body: unknown, createdById: string) => {
  const parsed = billSchema.parse(body);
  const split = calculateBillSplit(parsed);
  return {
    allowDuplicate: parsed.allowDuplicate,
    bill: {
      restaurantId: parsed.restaurantId,
      baseCost: parsed.baseCost,
      vat: parsed.vat,
      shippingFee: parsed.shippingFee,
      paymentUrl: parsed.paymentUrl ?? null,
      discounts: (parsed.discounts ?? []) as Prisma.InputJsonValue,
      vouchers: (parsed.vouchers ?? []) as Prisma.InputJsonValue,
      totalCost: split.totalCost,
      createdById,
      duplicateFingerprint: createBillFingerprint(parsed),
    },
    participants: split.participants,
  };
};

const participantCreateData = (
  participants: ReturnType<typeof computeBillCreateData>['participants'],
) =>
  participants.map((participant) => ({
    memberId: participant.memberId,
    originCost: participant.originCost,
    allocatedVat: participant.allocatedVat,
    allocatedShipping: participant.allocatedShipping,
    discountApplied: participant.discountApplied,
    finalPrice: participant.finalPrice,
  }));

type PersistedParticipant = {
  memberId: string;
  originCost: number;
  allocatedVat: number;
  allocatedShipping: number;
  discountApplied: number;
  finalPrice: number;
};

const participantAllocationsChanged = (
  existing: PersistedParticipant[],
  next: PersistedParticipant[],
) => {
  if (existing.length !== next.length) return true;
  const byMember = new Map(existing.map((item) => [item.memberId, item]));
  return next.some((participant) => {
    const previous = byMember.get(participant.memberId);
    return (
      !previous ||
      previous.originCost !== participant.originCost ||
      previous.allocatedVat !== participant.allocatedVat ||
      previous.allocatedShipping !== participant.allocatedShipping ||
      previous.discountApplied !== participant.discountApplied ||
      previous.finalPrice !== participant.finalPrice
    );
  });
};

const validateParticipantIds = async (
  participantIds: string[],
  reply: FastifyReply,
) => {
  const userCount = await prisma.user.count({
    where: { id: { in: participantIds } },
  });
  if (userCount !== participantIds.length) {
    reply.code(400).send({
      code: 'INVALID_PARTICIPANTS',
      message: 'One or more participants do not exist',
    });
    return false;
  }
  return true;
};

/**
 * Bill routes keep shared bill math close to bill persistence and permissions.
 */
export const registerBillRoutes = (app: FastifyInstance) => {
  app.get(
    '/bills',
    { preHandler: requireAuthenticatedUser },
    async (request) => {
      const query = billListQuerySchema.parse(request.query);
      const requestedStatus =
        query.archive === 'archived'
          ? EntryStatus.ARCHIVED
          : query.archive === 'all'
            ? undefined
            : EntryStatus.ACTIVE;
      const status = isHeadChef(request.currentUser)
        ? requestedStatus
        : EntryStatus.ACTIVE;
      const authorization: Prisma.BillWhereInput = isHeadChef(
        request.currentUser,
      )
        ? {}
        : isSousChefOrAbove(request.currentUser)
          ? {
              OR: [
                { createdById: request.currentUser.id },
                {
                  participants: { some: { memberId: request.currentUser.id } },
                },
              ],
            }
          : {
              participants: {
                some: {
                  memberId: request.currentUser.id,
                  ...(query.paymentStatus
                    ? { paymentStatus: query.paymentStatus }
                    : {}),
                },
              },
            };
      const participantFilter =
        isSousChefOrAbove(request.currentUser) &&
        (query.participantId || query.paymentStatus)
          ? {
              participants: {
                some: {
                  ...(query.participantId
                    ? { memberId: query.participantId }
                    : {}),
                  ...(query.paymentStatus
                    ? { paymentStatus: query.paymentStatus }
                    : {}),
                },
              },
            }
          : {};
      const participantIds = (query.participantIds ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 100);
      const to = query.to
        ? new Date(
            query.to.getUTCHours() === 0 &&
              query.to.getUTCMinutes() === 0 &&
              query.to.getUTCSeconds() === 0
              ? query.to.getTime() + 86_400_000 - 1
              : query.to.getTime(),
          )
        : undefined;
      const orderBy: Prisma.BillOrderByWithRelationInput[] =
        query.sort === 'created-asc'
          ? [{ createdAt: 'asc' }, { id: 'asc' }]
          : query.sort === 'total-desc'
            ? [{ totalCost: 'desc' }, { id: 'desc' }]
            : query.sort === 'total-asc'
              ? [{ totalCost: 'asc' }, { id: 'asc' }]
              : [{ createdAt: 'desc' }, { id: 'desc' }];
      const rows = await prisma.bill.findMany({
        where: {
          AND: [
            authorization,
            participantFilter,
            ...participantIds.map((memberId) => ({
              participants: { some: { memberId } },
            })),
            {
              status,
              restaurantId: query.restaurantId,
              createdById: query.ownerId,
              createdAt:
                query.from || to ? { gte: query.from, lte: to } : undefined,
            },
          ],
        },
        include: billResponseInclude,
        orderBy,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
        take: query.limit + 1,
      });
      return pageResult(
        rows.map((bill) => serializeBillResponse(bill, request.currentUser.id)),
        query.limit,
      );
    },
  );

  app.get(
    '/bills/:id',
    { preHandler: requireAuthenticatedUser },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const bill = await prisma.bill.findUnique({
        where: { id },
        include: billResponseInclude,
      });
      if (!bill) return reply.code(404).send({ message: 'Bill not found' });
      if (!canViewBill(bill, request)) {
        return reply
          .code(403)
          .send({ message: 'Not allowed to view this bill' });
      }
      return serializeBillResponse(bill, request.currentUser.id);
    },
  );

  app.get(
    '/bills/:id/activity',
    { preHandler: requireAuthenticatedUser },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const bill = await prisma.bill.findUnique({
        where: { id },
        select: {
          id: true,
          createdAt: true,
          createdById: true,
          createdBy: { select: billActivityActorSelect },
          participants: {
            select: {
              memberId: true,
              member: { select: billActivityActorSelect },
            },
          },
          auditLogs: {
            select: {
              id: true,
              action: true,
              before: true,
              after: true,
              createdAt: true,
              user: { select: billActivityActorSelect },
            },
          },
        },
      });
      if (!bill) return reply.code(404).send({ message: 'Bill not found' });
      if (!canViewBill(bill, request)) {
        return reply
          .code(403)
          .send({ message: 'Not allowed to view this bill' });
      }
      return buildBillActivityTimeline(bill);
    },
  );

  app.post(
    '/bills',
    { preHandler: [requireAuthenticatedUser, requireSousChefOrHeadChef] },
    async (request, reply) => {
      const computed = computeBillCreateData(
        request.body,
        request.currentUser.id,
      );
      const participantIds = computed.participants.map(
        (participant) => participant.memberId,
      );
      if (!(await validateParticipantIds(participantIds, reply))) return;
      const created = await prisma.$transaction(async (tx) => {
        if (!computed.allowDuplicate) {
          const lockKey = `${request.currentUser.id}:${computed.bill.duplicateFingerprint}`;
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))::text AS lock`;
          let duplicate = await tx.bill.findFirst({
            where: {
              createdById: request.currentUser.id,
              duplicateFingerprint: computed.bill.duplicateFingerprint,
              status: EntryStatus.ACTIVE,
            },
            orderBy: { createdAt: 'desc' },
            select: { id: true },
          });
          if (!duplicate) {
            const legacyCandidates = await tx.bill.findMany({
              where: {
                createdById: request.currentUser.id,
                duplicateFingerprint: null,
                status: EntryStatus.ACTIVE,
                restaurantId: computed.bill.restaurantId,
                baseCost: computed.bill.baseCost,
                vat: computed.bill.vat,
                shippingFee: computed.bill.shippingFee,
                paymentUrl: computed.bill.paymentUrl,
              },
              include: {
                participants: {
                  select: { memberId: true, originCost: true },
                },
              },
            });
            const matchingLegacy = legacyCandidates.find(
              (candidate) =>
                createBillFingerprint({
                  ...candidate,
                  discounts: Array.isArray(candidate.discounts)
                    ? candidate.discounts
                    : [],
                  vouchers: Array.isArray(candidate.vouchers)
                    ? candidate.vouchers
                    : [],
                }) === computed.bill.duplicateFingerprint,
            );
            if (matchingLegacy) {
              await tx.bill.update({
                where: { id: matchingLegacy.id },
                data: {
                  duplicateFingerprint: computed.bill.duplicateFingerprint,
                },
              });
              duplicate = { id: matchingLegacy.id };
            }
          }
          if (duplicate) return { duplicate } as const;
        }
        const bill = await tx.bill.create({
          data: {
            ...computed.bill,
            participants: {
              create: participantCreateData(computed.participants),
            },
          },
          include: billResponseInclude,
        });
        return { bill } as const;
      });
      if (created.duplicate) {
        return reply.code(409).send({
          code: 'BILL_DUPLICATE_DETECTED',
          message: 'An identical active bill already exists',
          existingBillId: created.duplicate.id,
        });
      }
      const { bill } = created;
      request.log.info({ event: 'bill_created', billId: bill.id });
      return reply
        .code(201)
        .send(serializeBillResponse(bill, request.currentUser.id));
    },
  );

  app.put(
    '/bills/:id',
    { preHandler: [requireAuthenticatedUser, requireSousChefOrHeadChef] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const existing = await prisma.bill.findUnique({
        where: { id },
        include: { participants: true },
      });
      if (!existing) return reply.code(404).send({ message: 'Bill not found' });
      if (!canManageBill(existing, request)) {
        return reply
          .code(403)
          .send({ message: 'Only the owner or HEAD_CHEF can edit this bill' });
      }
      const computed = computeBillCreateData(
        request.body,
        existing.createdById,
      );
      const participantIds = computed.participants.map(
        (participant) => participant.memberId,
      );
      if (!(await validateParticipantIds(participantIds, reply))) return;
      const nextParticipants = participantCreateData(computed.participants);
      const hasPaidParticipant = existing.participants.some(
        (participant) => participant.paymentStatus === PaymentStatus.PAID,
      );
      if (
        hasPaidParticipant &&
        participantAllocationsChanged(existing.participants, nextParticipants)
      ) {
        return reply.code(409).send({
          code: 'PAID_BILL_AMENDMENT_BLOCKED',
          message:
            'Participant or financial allocations cannot change after payment',
        });
      }
      const bill = await prisma.$transaction(async (tx) => {
        await tx.billParticipant.deleteMany({
          where: { billId: id, memberId: { notIn: participantIds } },
        });
        for (const participant of nextParticipants) {
          await tx.billParticipant.upsert({
            where: {
              billId_memberId: {
                billId: id,
                memberId: participant.memberId,
              },
            },
            create: { billId: id, ...participant },
            update: participant,
          });
        }
        const updated = await tx.bill.update({
          where: { id },
          data: {
            ...computed.bill,
            createdById: existing.createdById,
          },
          include: billResponseInclude,
        });
        await tx.billAuditLog.create({
          data: {
            billId: id,
            userId: request.currentUser.id,
            action: 'UPDATED',
            before: existing as unknown as Prisma.InputJsonValue,
            after: {
              ...computed.bill,
              participants: nextParticipants,
            } as unknown as Prisma.InputJsonValue,
          },
        });
        return updated;
      });
      return serializeBillResponse(bill, request.currentUser.id);
    },
  );

  app.patch(
    '/bills/:id/archive',
    { preHandler: [requireAuthenticatedUser, requireHeadChef] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const bill = await prisma.bill.findUnique({ where: { id } });
      if (!bill) return reply.code(404).send({ message: 'Bill not found' });
      if (!canManageBill(bill, request)) {
        return reply.code(403).send({
          message: 'Only the owner or HEAD_CHEF can archive this bill',
        });
      }
      return prisma.$transaction(async (tx) => {
        const updated = await tx.bill.update({
          where: { id },
          data: { status: EntryStatus.ARCHIVED },
          include: billResponseInclude,
        });
        await tx.billAuditLog.create({
          data: {
            billId: id,
            userId: request.currentUser.id,
            action: 'ARCHIVED',
            before: { status: bill.status },
            after: { status: EntryStatus.ARCHIVED },
          },
        });
        return serializeBillResponse(updated, request.currentUser.id);
      });
    },
  );

  app.patch(
    '/bills/:id/restore',
    { preHandler: [requireAuthenticatedUser, requireHeadChef] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const bill = await prisma.bill.findUnique({ where: { id } });
      if (!bill) return reply.code(404).send({ message: 'Bill not found' });
      return prisma.$transaction(async (tx) => {
        const updated = await tx.bill.update({
          where: { id },
          data: { status: EntryStatus.ACTIVE },
          include: billResponseInclude,
        });
        await tx.billAuditLog.create({
          data: {
            billId: id,
            userId: request.currentUser.id,
            action: 'RESTORED',
            before: { status: bill.status },
            after: { status: EntryStatus.ACTIVE },
          },
        });
        return serializeBillResponse(updated, request.currentUser.id);
      });
    },
  );

  app.patch(
    '/bills/:id/participants/:memberId/payment',
    { preHandler: requireAuthenticatedUser },
    async (request, reply) => {
      const { id, memberId } = request.params as {
        id: string;
        memberId: string;
      };
      const body = paymentStatusSchema.parse(request.body);
      const bill = await prisma.bill.findUnique({ where: { id } });
      if (!bill) return reply.code(404).send({ message: 'Bill not found' });
      const allowed =
        request.currentUser.id === memberId || canManageBill(bill, request);
      if (!allowed) {
        return reply
          .code(403)
          .send({ message: 'Not allowed to update this payment' });
      }
      if (body.status === body.expectedStatus) {
        return reply.code(409).send({
          code: 'PAYMENT_STATUS_UNCHANGED',
          message: 'Payment status is already up to date',
        });
      }
      const participant = await prisma.billParticipant.findUnique({
        where: { billId_memberId: { billId: id, memberId } },
      });
      if (!participant) {
        return reply
          .code(404)
          .send({ code: 'NOT_FOUND', message: 'Participant not found' });
      }
      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.billParticipant.updateMany({
          where: {
            billId: id,
            memberId,
            paymentStatus: body.expectedStatus,
          },
          data: {
            paymentStatus: body.status,
            paidAt: body.status === PaymentStatus.PAID ? new Date() : null,
          },
        });
        if (result.count !== 1) return null;
        const changed = await tx.billParticipant.findUniqueOrThrow({
          where: { billId_memberId: { billId: id, memberId } },
          include: paymentResponseInclude,
        });
        await tx.billAuditLog.create({
          data: {
            billId: id,
            userId: request.currentUser.id,
            action: 'PAYMENT_STATUS_CHANGED',
            before: {
              memberId,
              paymentStatus: participant.paymentStatus,
              paidAt: participant.paidAt?.toISOString() ?? null,
            },
            after: {
              memberId,
              paymentStatus: changed.paymentStatus,
              paidAt: changed.paidAt?.toISOString() ?? null,
            },
          },
        });
        return changed;
      });
      if (!updated) {
        return reply.code(409).send({
          code: 'PAYMENT_STATUS_CONFLICT',
          message: 'Payment status changed; refresh and try again',
        });
      }
      request.log.info({
        event: 'payment_status_changed',
        billId: id,
        memberId,
        status: body.status,
      });
      return updated;
    },
  );

  app.post(
    '/bills/:id/reminders',
    { preHandler: [requireAuthenticatedUser, requireSousChefOrHeadChef] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const bill = await prisma.bill.findUnique({
        where: { id },
        include: billResponseInclude,
      });
      if (!bill) return reply.code(404).send({ message: 'Bill not found' });
      if (!canManageBill(bill, request)) {
        return reply.code(403).send({
          message: 'Only the owner or HEAD_CHEF can remind participants',
        });
      }
      const waiting = bill.participants.filter(
        (participant) => participant.paymentStatus === PaymentStatus.WAITING,
      );
      const cutoff = new Date(Date.now() - REMINDER_COOLDOWN_MS);
      const recent = await prisma.notification.findMany({
        where: {
          billId: bill.id,
          userId: { in: waiting.map((participant) => participant.memberId) },
          createdAt: { gte: cutoff },
        },
        select: { userId: true },
      });
      const recentlyReminded = new Set(recent.map((item) => item.userId));
      const optedOut = new Set(
        (
          await prisma.user.findMany({
            where: {
              id: { in: waiting.map((participant) => participant.memberId) },
              paymentRemindersEnabled: false,
            },
            select: { id: true },
          })
        ).map((user) => user.id),
      );
      const eligible = waiting.filter(
        (participant) =>
          !recentlyReminded.has(participant.memberId) &&
          !optedOut.has(participant.memberId),
      );
      const result = {
        sent: eligible.length,
        skipped: waiting.length - eligible.length,
        preferenceSkipped: waiting.filter((participant) =>
          optedOut.has(participant.memberId),
        ).length,
        cooldownSeconds: REMINDER_COOLDOWN_MS / 1000,
      };
      await prisma.$transaction(async (tx) => {
        await tx.notification.createMany({
          data: eligible.map((participant) => ({
            userId: participant.memberId,
            billId: bill.id,
            message: `Payment reminder for ${bill.restaurant.name}: ${participant.finalPrice} VND waiting.`,
          })),
        });
        await tx.billAuditLog.create({
          data: {
            billId: id,
            userId: request.currentUser.id,
            action: 'REMINDERS_SENT',
            after: result,
          },
        });
      });
      return result;
    },
  );
};
