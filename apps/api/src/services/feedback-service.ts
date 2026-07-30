import { EntryStatus, PaymentStatus, Prisma } from '@prisma/client';

import {
  badRequest,
  conflict,
  forbidden,
  notFound,
} from '../http/app-error.js';
import { prisma } from '../lib/prisma.js';
import type { CurrentUser } from '../lib/roles.js';
import { isHeadChef } from '../lib/roles.js';

/**
 * Restaurant feedback: eligibility, aggregates, and per-author mutations.
 *
 * Routes keep parsing and status codes; every Prisma call and every
 * authorization decision lives here, so the rules can be read in one place.
 */

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

/** Ratings are stored as decimals but travel over the wire as numbers. */
const serializeFeedback = <
  T extends { foodRating: Prisma.Decimal; serviceRating: Prisma.Decimal },
>(
  feedback: T,
) => ({
  ...feedback,
  foodRating: feedback.foodRating.toNumber(),
  serviceRating: feedback.serviceRating.toNumber(),
});

const RESTAURANT_MISSING = () =>
  notFound('RESTAURANT_NOT_FOUND', 'Restaurant was not found');

const FEEDBACK_MISSING = () =>
  notFound('FEEDBACK_NOT_FOUND', 'Feedback was not found');

/**
 * An archived restaurant is invisible to everyone below HEAD_CHEF, and is
 * reported as missing rather than forbidden so archival is not observable.
 */
const ensureRestaurantVisible = async (
  restaurantId: string,
  currentUser: CurrentUser,
) => {
  const restaurant = await prisma.restaurantEntry.findUnique({
    where: { id: restaurantId },
    select: { id: true, status: true },
  });
  if (
    !restaurant ||
    (restaurant.status === EntryStatus.ARCHIVED && !isHeadChef(currentUser))
  ) {
    throw RESTAURANT_MISSING();
  }
  return restaurant;
};

/** Confirms the caller owns the feedback before it can be changed. */
const ensureOwnFeedback = async (id: string, currentUser: CurrentUser) => {
  const existing = await prisma.feedback.findUnique({
    where: { id },
    select: { userId: true, restaurantId: true },
  });
  if (!existing || existing.userId !== currentUser.id) throw FEEDBACK_MISSING();
  await ensureRestaurantVisible(existing.restaurantId, currentUser);
  return existing;
};

export type FeedbackInput = {
  foodRating: number;
  serviceRating: number;
  comment?: string | null;
};

export const listRestaurantFeedback = async (
  restaurantId: string,
  query: { cursor?: string; limit: number },
  currentUser: CurrentUser,
) => {
  await ensureRestaurantVisible(restaurantId, currentUser);

  if (query.cursor) {
    const cursor = await prisma.feedback.findFirst({
      where: { id: query.cursor, restaurantId },
      select: { id: true },
    });
    if (!cursor) {
      throw badRequest('FEEDBACK_CURSOR_INVALID', 'Feedback cursor is invalid');
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
        memberId: currentUser.id,
        paymentStatus: PaymentStatus.PAID,
        bill: { restaurantId },
      },
      orderBy: { bill: { createdAt: 'desc' } },
      select: { bill: { select: { id: true, createdAt: true, status: true } } },
    }),
  ]);

  const participations = await Promise.all(
    paidParticipations.map(async ({ bill }) => ({
      billId: bill.id,
      billCreatedAt: bill.createdAt,
      billStatus: bill.status,
      feedback: await prisma.feedback.findUnique({
        where: { billId_userId: { billId: bill.id, userId: currentUser.id } },
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
};

/**
 * Feedback requires a *paid* participation in the bill being reviewed, which
 * is what stops non-diners rating a restaurant.
 */
export const createBillFeedback = async (
  billId: string,
  body: FeedbackInput,
  currentUser: CurrentUser,
) => {
  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    select: {
      restaurantId: true,
      restaurant: { select: { status: true } },
      participants: {
        where: { memberId: currentUser.id },
        select: { paymentStatus: true },
      },
    },
  });
  const participant = bill?.participants[0];
  if (!bill || participant?.paymentStatus !== PaymentStatus.PAID) {
    throw forbidden(
      'FEEDBACK_PAYMENT_REQUIRED',
      'Paid bill participation is required',
    );
  }
  if (
    bill.restaurant.status === EntryStatus.ARCHIVED &&
    !isHeadChef(currentUser)
  ) {
    throw RESTAURANT_MISSING();
  }

  try {
    const created = await prisma.feedback.create({
      data: {
        userId: currentUser.id,
        billId,
        restaurantId: bill.restaurantId,
        foodRating: body.foodRating,
        serviceRating: body.serviceRating,
        comment: body.comment?.trim() || null,
      },
      select: feedbackSelect,
    });
    return serializeFeedback(created);
  } catch (error) {
    // One feedback per bill+user is enforced by a unique constraint.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw conflict(
        'FEEDBACK_ALREADY_EXISTS',
        'Feedback already exists for this bill',
      );
    }
    throw error;
  }
};

export const updateFeedback = async (
  id: string,
  body: FeedbackInput,
  currentUser: CurrentUser,
) => {
  await ensureOwnFeedback(id, currentUser);
  const updated = await prisma.feedback.update({
    where: { id },
    data: {
      foodRating: body.foodRating,
      serviceRating: body.serviceRating,
      comment: body.comment?.trim() || null,
    },
    select: feedbackSelect,
  });
  return serializeFeedback(updated);
};

export const deleteFeedback = async (id: string, currentUser: CurrentUser) => {
  await ensureOwnFeedback(id, currentUser);
  const deleted = await prisma.feedback.deleteMany({
    where: { id, userId: currentUser.id },
  });
  if (deleted.count === 0) throw FEEDBACK_MISSING();
};
