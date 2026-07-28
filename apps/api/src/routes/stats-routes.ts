import type { FastifyInstance } from 'fastify';
import { EntryStatus, PaymentStatus } from '@prisma/client';
import {
  formatIsoDateOnly,
  parseIsoDateOnly,
  todayInHoChiMinh,
} from '@ff-restaurent/shared';
import { requireAuthenticatedUser } from '../http/auth-guards.js';
import { prisma } from '../lib/prisma.js';
import { statsQuerySchema } from '../schemas/index.js';

type StatsQuery = ReturnType<typeof statsQuerySchema.parse>;

export const resolveStatsDateRange = (query: StatsQuery, now = new Date()) => {
  if (query.range === 'custom') {
    if (!query.from || !query.to) {
      throw new Error('Custom statistics ranges require both dates');
    }
    const start = parseIsoDateOnly(query.from);
    const end = parseIsoDateOnly(query.to);
    end.setUTCDate(end.getUTCDate() + 1);
    return { start, end };
  }

  const today = parseIsoDateOnly(todayInHoChiMinh(now));
  const start = new Date(today);
  if (query.range === 'weekly') start.setUTCDate(start.getUTCDate() - 6);
  else if (query.range === 'yearly')
    start.setUTCFullYear(start.getUTCFullYear() - 1);
  else start.setUTCMonth(start.getUTCMonth() - 1);
  const end = new Date(today);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
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
            occurredOn: { gte: start, lt: end },
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
          'Uncategorized';
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
          formatIsoDateOnly(participant.bill.occurredOn).slice(0, 7),
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
