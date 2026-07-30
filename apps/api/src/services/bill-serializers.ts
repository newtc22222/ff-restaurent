import { EntryStatus } from '@prisma/client';

import { formatIsoDateOnly } from '@ff-restaurent/shared';

import {
  type PublicRestaurantRecord,
  buildPublicRestaurantSelect,
  serializePublicRestaurant,
} from '../contracts/restaurant-contract.js';
import { publicUserSelect } from '../lib/roles.js';
import { signedQrUrl } from './storage.js';

/**
 * Bill response shaping: the Prisma `include` trees and the serializers that
 * turn a persisted bill into its API representation.
 *
 * Kept apart from the route handlers so the response contract can change
 * without touching routing, and apart from bill-service so persistence logic
 * does not depend on presentation.
 */

export const buildBillResponseInclude = (userId: string) => ({
  restaurant: { select: buildPublicRestaurantSelect(userId) },
  createdBy: { select: publicUserSelect },
  participants: {
    include: { member: { select: publicUserSelect } },
    orderBy: { member: { name: 'asc' as const } },
  },
  paymentQrImage: {
    select: {
      id: true,
      label: true,
      storagePath: true,
      status: true,
    },
  },
});

export const paymentResponseInclude = {
  member: { select: publicUserSelect },
  bill: true,
};

/**
 * Async because payment QR images live in private storage and are exposed as
 * short-lived signed URLs rather than as their storage paths.
 */
export const serializeBill = async <
  T extends {
    restaurant: PublicRestaurantRecord;
    occurredOn: Date;
    paymentQrImage?: null | {
      id: string;
      label: string;
      storagePath: string;
      status: EntryStatus;
    };
  },
>(
  bill: T,
  userId: string,
) => ({
  ...bill,
  occurredOn: formatIsoDateOnly(bill.occurredOn),
  restaurant: serializePublicRestaurant(bill.restaurant, userId),
  paymentQrImage: bill.paymentQrImage
    ? {
        id: bill.paymentQrImage.id,
        label: bill.paymentQrImage.label,
        status: bill.paymentQrImage.status,
        imageUrl: await signedQrUrl(bill.paymentQrImage.storagePath),
      }
    : null,
});
