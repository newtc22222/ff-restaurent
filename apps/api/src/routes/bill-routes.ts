import type { FastifyInstance, FastifyRequest } from 'fastify';
import { EntryStatus, PaymentStatus, Prisma } from '@prisma/client';
import { calculateBillSplit } from '@ff-restaurent/shared';
import {
  requireAuthenticatedUser,
  requireHeadChef,
  requireSousChefOrHeadChef,
} from '../http/auth-guards.js';
import { prisma } from '../prisma.js';
import { isHeadChef, isSousChefOrAbove } from '../roles.js';
import { billSchema } from '../schemas.js';

const billWithRestaurantCreatorAndParticipants = {
  restaurant: true,
  createdBy: true,
  participants: {
    include: { member: true },
    orderBy: { member: { name: 'asc' as const } },
  },
};

const canManageBill = (
  bill: { createdById: string },
  request: FastifyRequest,
) =>
  isHeadChef(request.currentUser) ||
  bill.createdById === request.currentUser.id;

const computeBillCreateData = (body: unknown, createdById: string) => {
  const parsed = billSchema.parse(body);
  const split = calculateBillSplit(parsed);
  return {
    bill: {
      restaurantId: parsed.restaurantId,
      baseCost: parsed.baseCost,
      vat: parsed.vat,
      shippingFee: parsed.shippingFee,
      discounts: (parsed.discounts ?? []) as Prisma.InputJsonValue,
      vouchers: (parsed.vouchers ?? []) as Prisma.InputJsonValue,
      totalCost: split.totalCost,
      createdById,
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

/**
 * Bill routes keep shared bill math close to bill persistence and permissions.
 */
export const registerBillRoutes = (app: FastifyInstance) => {
  app.get(
    '/bills',
    { preHandler: requireAuthenticatedUser },
    async (request) => {
      const query = request.query as { includeArchived?: string };
      const includeArchived =
        query.includeArchived === 'true' && isHeadChef(request.currentUser);
      const statusFilter = includeArchived ? undefined : EntryStatus.ACTIVE;
      const where = isHeadChef(request.currentUser)
        ? { status: statusFilter }
        : isSousChefOrAbove(request.currentUser)
          ? {
              status: statusFilter,
              OR: [
                { createdById: request.currentUser.id },
                {
                  participants: { some: { memberId: request.currentUser.id } },
                },
              ],
            }
          : {
              status: statusFilter,
              participants: { some: { memberId: request.currentUser.id } },
            };
      return prisma.bill.findMany({
        where,
        include: billWithRestaurantCreatorAndParticipants,
        orderBy: { createdAt: 'desc' },
      });
    },
  );

  app.get(
    '/bills/:id',
    { preHandler: requireAuthenticatedUser },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const bill = await prisma.bill.findUnique({
        where: { id },
        include: billWithRestaurantCreatorAndParticipants,
      });
      if (!bill) return reply.code(404).send({ message: 'Bill not found' });
      const allowed =
        isHeadChef(request.currentUser) ||
        bill.createdById === request.currentUser.id ||
        bill.participants.some(
          (participant) => participant.memberId === request.currentUser.id,
        );
      if (!allowed) {
        return reply
          .code(403)
          .send({ message: 'Not allowed to view this bill' });
      }
      return bill;
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
      const users = await prisma.user.count({
        where: { id: { in: participantIds } },
      });
      if (users !== participantIds.length) {
        return reply
          .code(400)
          .send({ message: 'One or more participants do not exist' });
      }
      const bill = await prisma.bill.create({
        data: {
          ...computed.bill,
          participants: {
            create: participantCreateData(computed.participants),
          },
        },
        include: billWithRestaurantCreatorAndParticipants,
      });
      return reply.code(201).send(bill);
    },
  );

  app.put(
    '/bills/:id',
    { preHandler: [requireAuthenticatedUser, requireSousChefOrHeadChef] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const existing = await prisma.bill.findUnique({ where: { id } });
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
      const bill = await prisma.$transaction(async (tx) => {
        await tx.billParticipant.deleteMany({ where: { billId: id } });
        const updated = await tx.bill.update({
          where: { id },
          data: {
            ...computed.bill,
            createdById: existing.createdById,
            participants: {
              create: participantCreateData(computed.participants),
            },
          },
          include: billWithRestaurantCreatorAndParticipants,
        });
        await tx.billAuditLog.create({
          data: {
            billId: id,
            userId: request.currentUser.id,
            action: 'UPDATED',
            before: existing as unknown as Prisma.InputJsonValue,
            after: computed.bill as unknown as Prisma.InputJsonValue,
          },
        });
        return updated;
      });
      return bill;
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
      return prisma.bill.update({
        where: { id },
        data: { status: EntryStatus.ARCHIVED },
        include: billWithRestaurantCreatorAndParticipants,
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
      return prisma.bill.update({
        where: { id },
        data: { status: EntryStatus.ACTIVE },
        include: billWithRestaurantCreatorAndParticipants,
      });
    },
  );

  app.patch(
    '/bills/:id/participants/:memberId/pay',
    { preHandler: requireAuthenticatedUser },
    async (request, reply) => {
      const { id, memberId } = request.params as {
        id: string;
        memberId: string;
      };
      const bill = await prisma.bill.findUnique({ where: { id } });
      if (!bill) return reply.code(404).send({ message: 'Bill not found' });
      const allowed =
        request.currentUser.id === memberId || canManageBill(bill, request);
      if (!allowed) {
        return reply
          .code(403)
          .send({ message: 'Not allowed to update this payment' });
      }
      return prisma.billParticipant.update({
        where: { billId_memberId: { billId: id, memberId } },
        data: { paymentStatus: PaymentStatus.PAID, paidAt: new Date() },
        include: { member: true, bill: true },
      });
    },
  );

  app.post(
    '/bills/:id/reminders',
    { preHandler: [requireAuthenticatedUser, requireSousChefOrHeadChef] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const bill = await prisma.bill.findUnique({
        where: { id },
        include: billWithRestaurantCreatorAndParticipants,
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
      await prisma.notification.createMany({
        data: waiting.map((participant) => ({
          userId: participant.memberId,
          billId: bill.id,
          message: `Payment reminder for ${bill.restaurant.name}: ${participant.finalPrice} VND waiting.`,
        })),
      });
      return { sent: waiting.length };
    },
  );
};
