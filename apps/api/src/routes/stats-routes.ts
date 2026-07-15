import type { FastifyInstance } from 'fastify';
import { EntryStatus, PaymentStatus } from '@prisma/client';
import { requireAuthenticatedUser } from '../http/auth-guards.js';
import { prisma } from '../prisma.js';
import { statsQuerySchema } from '../schemas.js';

type StatsQuery = ReturnType<typeof statsQuerySchema.parse>;

export const resolveStatsDateRange = (query: StatsQuery, now = new Date()) => {
  if (query.range === 'custom') {
    const start = new Date(`${query.from}T00:00:00.000Z`);
    const end = new Date(`${query.to}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    return { start, end };
  }

  const start = new Date(now);
  if (query.range === 'weekly') start.setUTCDate(start.getUTCDate() - 7);
  else if (query.range === 'yearly')
    start.setUTCFullYear(start.getUTCFullYear() - 1);
  else start.setUTCMonth(start.getUTCMonth() - 1);
  return { start, end: now };
};

const addAmountToBucket = (
  bucket: Record<string, number>,
  key: string,
  amount: number,
) => {
  bucket[key] = (bucket[key] ?? 0) + amount;
};

/**
 * Stats routes summarize the authenticated user's own spending only.
 */
export const registerStatsRoutes = (app: FastifyInstance) => {
  app.get(
    '/stats/me',
    { preHandler: requireAuthenticatedUser },
    async (request) => {
      const query = statsQuerySchema.parse(request.query);
      const { start, end } = resolveStatsDateRange(query);
      const participants = await prisma.billParticipant.findMany({
        where: {
          memberId: request.currentUser.id,
          bill: {
            createdAt: { gte: start, lt: end },
            status: EntryStatus.ACTIVE,
          },
        },
        include: {
          bill: {
            include: {
              restaurant: {
                include: {
                  cuisines: {
                    where: { isPrimary: true },
                    include: { cuisine: true },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      });

      const byPaymentStatus: Record<string, number> = {};
      const byCuisineType: Record<string, number> = {};
      const byEntry: Record<string, number> = {};
      const byPeriod: Record<string, number> = {};
      const frequencyByRestaurant: Record<string, number> = {};
      const frequencyByCuisine: Record<string, number> = {};

      for (const participant of participants) {
        const primaryCuisine =
          participant.bill.restaurant.cuisines[0]?.cuisine.name ??
          participant.bill.restaurant.cuisineType;
        addAmountToBucket(
          byPaymentStatus,
          participant.paymentStatus,
          participant.finalPrice,
        );
        addAmountToBucket(
          byCuisineType,
          primaryCuisine,
          participant.finalPrice,
        );
        addAmountToBucket(
          byEntry,
          `${participant.bill.restaurant.type}: ${participant.bill.restaurant.name}`,
          participant.finalPrice,
        );
        addAmountToBucket(
          byPeriod,
          participant.bill.createdAt.toISOString().slice(0, 7),
          participant.finalPrice,
        );
        frequencyByRestaurant[participant.bill.restaurant.name] =
          (frequencyByRestaurant[participant.bill.restaurant.name] ?? 0) + 1;
        frequencyByCuisine[primaryCuisine] =
          (frequencyByCuisine[primaryCuisine] ?? 0) + 1;
      }

      const paid = byPaymentStatus[PaymentStatus.PAID] ?? 0;
      const waiting = byPaymentStatus[PaymentStatus.WAITING] ?? 0;
      const totalObligation = paid + waiting;

      return {
        totals: { paid, waiting, totalObligation },
        total: totalObligation,
        byPaymentStatus,
        byCuisineType,
        byEntry,
        byPeriod,
        frequencyByRestaurant,
        frequencyByCuisine,
      };
    },
  );
};
