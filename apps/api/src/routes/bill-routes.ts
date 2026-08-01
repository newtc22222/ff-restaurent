import { EntryStatus, PaymentStatus, Prisma } from '@prisma/client';
import type { FastifyInstance, FastifyRequest } from 'fastify';

import { AdjustmentAllocation, parseIsoDateOnly } from '@ff-restaurent/shared';

import {
  requireAuthenticatedUser,
  requireHeadChef,
  requireSousChefOrHeadChef,
} from '../http/auth-guards.js';
import { prisma } from '../lib/prisma.js';
import { isHeadChef, isSousChefOrAbove } from '../lib/roles.js';
import { billListQuerySchema, paymentStatusSchema } from '../schemas/index.js';
import {
  billActivityActorSelect,
  buildBillActivityTimeline,
} from '../services/bill-activity.js';
import {
  buildBillResponseInclude,
  paymentResponseInclude,
  serializeBill,
} from '../services/bill-serializers.js';
import {
  REMINDER_COOLDOWN_MS,
  computeBillCreateData,
  createBillFingerprint,
  participantAllocationsChanged,
  participantCreateData,
  validateParticipantIds,
  validatePaymentQr,
} from '../services/bill-service.js';
import { deliverPaymentReminderPush } from '../services/notification-service.js';

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
      const from = query.from ? parseIsoDateOnly(query.from) : undefined;
      const to = query.to ? parseIsoDateOnly(query.to) : undefined;
      const orderBy: Prisma.BillOrderByWithRelationInput[] =
        query.sort === 'created-asc'
          ? [{ occurredOn: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }]
          : query.sort === 'total-desc'
            ? [{ totalCost: 'desc' }, { id: 'desc' }]
            : query.sort === 'total-asc'
              ? [{ totalCost: 'asc' }, { id: 'asc' }]
              : [{ occurredOn: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }];
      const backward = query.direction === 'backward' && Boolean(query.cursor);
      const queriedRows = await prisma.bill.findMany({
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
              occurredOn: from || to ? { gte: from, lte: to } : undefined,
            },
          ],
        },
        include: buildBillResponseInclude(request.currentUser.id),
        orderBy,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
        take: backward ? -(query.limit + 1) : query.limit + 1,
      });
      const orderedRows = backward ? queriedRows.reverse() : queriedRows;
      const hasExtra = orderedRows.length > query.limit;
      const rows = backward
        ? hasExtra
          ? orderedRows.slice(1)
          : orderedRows
        : orderedRows.slice(0, query.limit);
      return {
        items: await Promise.all(
          rows.map((bill) => serializeBill(bill, request.currentUser.id)),
        ),
        pageInfo: {
          startCursor: rows.at(0)?.id ?? null,
          endCursor: rows.at(-1)?.id ?? null,
          hasPreviousPage: backward ? hasExtra : Boolean(query.cursor),
          hasNextPage: backward ? true : hasExtra,
        },
      };
    },
  );

  app.get(
    '/bills/:id',
    { preHandler: requireAuthenticatedUser },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const bill = await prisma.bill.findUnique({
        where: { id },
        include: buildBillResponseInclude(request.currentUser.id),
      });
      if (!bill) return reply.code(404).send({ message: 'Bill not found' });
      if (!canViewBill(bill, request)) {
        return reply
          .code(403)
          .send({ message: 'Not allowed to view this bill' });
      }
      return serializeBill(bill, request.currentUser.id);
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
      const qrCheck = await validatePaymentQr(
        computed.bill.paymentQrImageId,
        request.currentUser.id,
      );
      if (!qrCheck.ok) {
        return reply
          .code(400)
          .send({ code: qrCheck.code, message: qrCheck.message });
      }
      const participantIds = computed.participants.map(
        (participant) => participant.memberId,
      );
      const participantCheck = await validateParticipantIds(participantIds);
      if (!participantCheck.ok) {
        return reply.code(400).send({
          code: participantCheck.code,
          message: participantCheck.message,
        });
      }
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
            orderBy: [
              { occurredOn: 'desc' },
              { createdAt: 'desc' },
              { id: 'desc' },
            ],
            select: { id: true },
          });
          if (!duplicate) {
            const legacyCandidates = await tx.bill.findMany({
              where: {
                createdById: request.currentUser.id,
                status: EntryStatus.ACTIVE,
                restaurantId: computed.bill.restaurantId,
                occurredOn: computed.bill.occurredOn,
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
          include: buildBillResponseInclude(request.currentUser.id),
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
        .send(await serializeBill(bill, request.currentUser.id));
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
        existing.adjustmentAllocation as AdjustmentAllocation,
        existing.paymentUrl,
        existing.occurredOn,
      );
      const qrCheck = await validatePaymentQr(
        computed.bill.paymentQrImageId,
        existing.createdById,
      );
      if (!qrCheck.ok) {
        return reply
          .code(400)
          .send({ code: qrCheck.code, message: qrCheck.message });
      }
      const participantIds = computed.participants.map(
        (participant) => participant.memberId,
      );
      const existingParticipantIds = new Set(
        existing.participants.map((participant) => participant.memberId),
      );
      const participantCheck = await validateParticipantIds(
        participantIds.filter(
          (participantId) => !existingParticipantIds.has(participantId),
        ),
      );
      if (!participantCheck.ok) {
        return reply.code(400).send({
          code: participantCheck.code,
          message: participantCheck.message,
        });
      }
      const nextParticipants = participantCreateData(computed.participants);
      const hasPaidParticipant = existing.participants.some(
        (participant) => participant.paymentStatus === PaymentStatus.PAID,
      );
      if (
        hasPaidParticipant &&
        (existing.adjustmentAllocation !== computed.bill.adjustmentAllocation ||
          participantAllocationsChanged(
            existing.participants,
            nextParticipants,
          ))
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
          include: buildBillResponseInclude(request.currentUser.id),
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
      return serializeBill(bill, request.currentUser.id);
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
      const updated = await prisma.$transaction(async (tx) => {
        const updated = await tx.bill.update({
          where: { id },
          data: { status: EntryStatus.ARCHIVED },
          include: buildBillResponseInclude(request.currentUser.id),
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
        return updated;
      });
      return serializeBill(updated, request.currentUser.id);
    },
  );

  app.patch(
    '/bills/:id/restore',
    { preHandler: [requireAuthenticatedUser, requireHeadChef] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const bill = await prisma.bill.findUnique({ where: { id } });
      if (!bill) return reply.code(404).send({ message: 'Bill not found' });
      const updated = await prisma.$transaction(async (tx) => {
        const updated = await tx.bill.update({
          where: { id },
          data: { status: EntryStatus.ACTIVE },
          include: buildBillResponseInclude(request.currentUser.id),
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
        return updated;
      });
      return serializeBill(updated, request.currentUser.id);
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
        include: buildBillResponseInclude(request.currentUser.id),
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
      const reminderBucket = Math.floor(Date.now() / REMINDER_COOLDOWN_MS);
      const deduplicationKey = `payment-reminder:${bill.id}:${reminderBucket}`;
      await prisma.$transaction(async (tx) => {
        await tx.notification.createMany({
          data: eligible.map((participant) => ({
            userId: participant.memberId,
            billId: bill.id,
            category: 'PAYMENT_REMINDER',
            targetUrl: `/bills/${bill.id}`,
            actorId: request.currentUser.id,
            deduplicationKey,
            data: {
              actorName: request.currentUser.name,
              restaurantName: bill.restaurant.name,
              finalPrice: participant.finalPrice,
            },
            message: `Payment reminder for ${bill.restaurant.name}: ${participant.finalPrice} VND waiting.`,
            pushStatus: 'PENDING',
          })),
          skipDuplicates: true,
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
      void deliverPaymentReminderPush(
        eligible.map((participant) => participant.memberId),
        bill.restaurant.name,
        `/bills/${bill.id}`,
        deduplicationKey,
        request.log,
      );
      return result;
    },
  );
};
