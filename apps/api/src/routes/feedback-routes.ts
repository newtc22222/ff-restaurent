import type { FastifyInstance } from 'fastify';
import { EntryStatus, PaymentStatus, Prisma } from '@prisma/client';
import { requireAuthenticatedUser } from '../http/auth-guards.js';
import { prisma } from '../prisma.js';
import { isHeadChef } from '../roles.js';
import { feedbackQuerySchema, feedbackSchema } from '../schemas.js';

const feedbackSelect = {
  id: true,
  billId: true,
  restaurantId: true,
  foodRating: true,
  serviceRating: true,
  comment: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, username: true, name: true } },
} satisfies Prisma.FeedbackSelect;

const serializeFeedback = <
  T extends { foodRating: Prisma.Decimal; serviceRating: Prisma.Decimal },
>(
  feedback: T,
) => ({
  ...feedback,
  foodRating: feedback.foodRating.toNumber(),
  serviceRating: feedback.serviceRating.toNumber(),
});

const feedbackError = (statusCode: number, code: string, message: string) =>
  Object.assign(new Error(message), { statusCode, code });

const ensureRestaurantVisible = async (
  restaurantId: string,
  currentUser: Parameters<typeof isHeadChef>[0],
) => {
  const restaurant = await prisma.restaurantEntry.findUnique({
    where: { id: restaurantId },
    select: { id: true, status: true },
  });
  if (
    !restaurant ||
    (restaurant.status === EntryStatus.ARCHIVED && !isHeadChef(currentUser))
  ) {
    throw feedbackError(
      404,
      'RESTAURANT_NOT_FOUND',
      'Restaurant was not found',
    );
  }
  return restaurant;
};

export const registerFeedbackRoutes = (app: FastifyInstance) => {
  app.get(
    '/restaurants/:id/feedback',
    { preHandler: requireAuthenticatedUser },
    async (request) => {
      const { id: restaurantId } = request.params as { id: string };
      const query = feedbackQuerySchema.parse(request.query);
      await ensureRestaurantVisible(restaurantId, request.currentUser);

      if (query.cursor) {
        const cursor = await prisma.feedback.findFirst({
          where: { id: query.cursor, restaurantId },
          select: { id: true },
        });
        if (!cursor) {
          throw feedbackError(
            400,
            'FEEDBACK_CURSOR_INVALID',
            'Feedback cursor is invalid',
          );
        }
      }

      const [rows, aggregate, paidParticipations] = await Promise.all([
        prisma.feedback.findMany({
          where: { restaurantId },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: query.limit + 1,
          ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
          select: feedbackSelect,
        }),
        prisma.feedback.aggregate({
          where: { restaurantId },
          _avg: { foodRating: true, serviceRating: true },
          _count: { _all: true },
        }),
        prisma.billParticipant.findMany({
          where: {
            memberId: request.currentUser.id,
            paymentStatus: PaymentStatus.PAID,
            bill: { restaurantId },
          },
          orderBy: { bill: { createdAt: 'desc' } },
          select: {
            bill: { select: { id: true, createdAt: true, status: true } },
          },
        }),
      ]);

      const participations = await Promise.all(
        paidParticipations.map(async ({ bill }) => ({
          billId: bill.id,
          billCreatedAt: bill.createdAt,
          billStatus: bill.status,
          feedback: await prisma.feedback.findUnique({
            where: {
              billId_userId: {
                billId: bill.id,
                userId: request.currentUser.id,
              },
            },
            select: feedbackSelect,
          }),
        })),
      );
      const hasNextPage = rows.length > query.limit;
      const items = rows.slice(0, query.limit);
      return {
        items: items.map(serializeFeedback),
        pageInfo: {
          endCursor: hasNextPage ? (items.at(-1)?.id ?? null) : null,
          hasNextPage,
        },
        aggregates: {
          foodRating: aggregate._avg.foodRating?.toNumber() ?? null,
          serviceRating: aggregate._avg.serviceRating?.toNumber() ?? null,
          feedbackCount: aggregate._count._all,
        },
        eligibleBills: participations.map((participation) => ({
          ...participation,
          feedback: participation.feedback
            ? serializeFeedback(participation.feedback)
            : null,
        })),
      };
    },
  );

  app.post(
    '/bills/:billId/feedback',
    { preHandler: requireAuthenticatedUser },
    async (request, reply) => {
      const { billId } = request.params as { billId: string };
      const body = feedbackSchema.parse(request.body);
      const bill = await prisma.bill.findUnique({
        where: { id: billId },
        select: {
          restaurantId: true,
          restaurant: { select: { status: true } },
          participants: {
            where: { memberId: request.currentUser.id },
            select: { paymentStatus: true },
          },
        },
      });
      const participant = bill?.participants[0];
      if (!bill || participant?.paymentStatus !== PaymentStatus.PAID) {
        throw feedbackError(
          403,
          'FEEDBACK_PAYMENT_REQUIRED',
          'Paid bill participation is required',
        );
      }
      if (
        bill.restaurant.status === EntryStatus.ARCHIVED &&
        !isHeadChef(request.currentUser)
      ) {
        throw feedbackError(
          404,
          'RESTAURANT_NOT_FOUND',
          'Restaurant was not found',
        );
      }

      try {
        const created = await prisma.feedback.create({
          data: {
            userId: request.currentUser.id,
            billId,
            restaurantId: bill.restaurantId,
            foodRating: body.foodRating,
            serviceRating: body.serviceRating,
            comment: body.comment?.trim() || null,
          },
          select: feedbackSelect,
        });
        return reply.code(201).send(serializeFeedback(created));
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw feedbackError(
            409,
            'FEEDBACK_ALREADY_EXISTS',
            'Feedback already exists for this bill',
          );
        }
        throw error;
      }
    },
  );

  app.put(
    '/feedback/:id',
    { preHandler: requireAuthenticatedUser },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = feedbackSchema.parse(request.body);
      const existing = await prisma.feedback.findUnique({
        where: { id },
        select: { userId: true, restaurantId: true },
      });
      if (!existing || existing.userId !== request.currentUser.id) {
        throw feedbackError(
          404,
          'FEEDBACK_NOT_FOUND',
          'Feedback was not found',
        );
      }
      await ensureRestaurantVisible(existing.restaurantId, request.currentUser);
      return prisma.feedback
        .update({
          where: { id },
          data: {
            foodRating: body.foodRating,
            serviceRating: body.serviceRating,
            comment: body.comment?.trim() || null,
          },
          select: feedbackSelect,
        })
        .then(serializeFeedback);
    },
  );

  app.delete(
    '/feedback/:id',
    { preHandler: requireAuthenticatedUser },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const existing = await prisma.feedback.findUnique({
        where: { id },
        select: { userId: true, restaurantId: true },
      });
      if (!existing || existing.userId !== request.currentUser.id) {
        throw feedbackError(
          404,
          'FEEDBACK_NOT_FOUND',
          'Feedback was not found',
        );
      }
      await ensureRestaurantVisible(existing.restaurantId, request.currentUser);
      const deleted = await prisma.feedback.deleteMany({
        where: { id, userId: request.currentUser.id },
      });
      if (deleted.count === 0) {
        throw feedbackError(
          404,
          'FEEDBACK_NOT_FOUND',
          'Feedback was not found',
        );
      }
      return reply.code(204).send();
    },
  );
};
