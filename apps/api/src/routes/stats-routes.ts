import type { FastifyInstance } from 'fastify';
import { EntryStatus } from '@prisma/client';
import { requireAuthenticatedUser } from '../http/auth-guards.js';
import { prisma } from '../prisma.js';

const startDateForRange = (range: string | undefined) => {
  const date = new Date();
  if (range === 'weekly') date.setDate(date.getDate() - 7);
  else if (range === 'yearly') date.setFullYear(date.getFullYear() - 1);
  else date.setMonth(date.getMonth() - 1);
  return date;
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
      const query = request.query as { range?: string };
      const participants = await prisma.billParticipant.findMany({
        where: {
          memberId: request.currentUser.id,
          bill: {
            createdAt: { gte: startDateForRange(query.range) },
            status: EntryStatus.ACTIVE,
          },
        },
        include: { bill: { include: { restaurant: true } } },
      });

      const byPaymentStatus: Record<string, number> = {};
      const byCuisineType: Record<string, number> = {};
      const byEntry: Record<string, number> = {};
      const byPeriod: Record<string, number> = {};
      const frequencyByRestaurant: Record<string, number> = {};
      const frequencyByCuisine: Record<string, number> = {};

      for (const participant of participants) {
        addAmountToBucket(
          byPaymentStatus,
          participant.paymentStatus,
          participant.finalPrice,
        );
        addAmountToBucket(
          byCuisineType,
          participant.bill.restaurant.cuisineType,
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
        frequencyByCuisine[participant.bill.restaurant.cuisineType] =
          (frequencyByCuisine[participant.bill.restaurant.cuisineType] ?? 0) +
          1;
      }

      return {
        total: participants.reduce(
          (sum, participant) => sum + participant.finalPrice,
          0,
        ),
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
