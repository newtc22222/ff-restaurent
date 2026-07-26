import { createHash } from 'node:crypto';
import { EntryStatus, Prisma } from '@prisma/client';
import {
  AdjustmentAllocation,
  calculateBillSplit,
} from '@ff-restaurent/shared';
import { prisma } from './prisma.js';
import { billSchema } from './schemas/index.js';

/**
 * Bill domain logic: duplicate fingerprinting, split computation, and the
 * persistence-backed validations bill routes need.
 *
 * Validation returns a discriminated result rather than writing to a
 * FastifyReply, so the rules can be unit-tested without a request lifecycle
 * and routes stay responsible for HTTP mapping.
 */

/** Minimum interval between reminder batches for one bill. */
export const REMINDER_COOLDOWN_MS = 15 * 60 * 1000;

type FingerprintBill = {
  restaurantId: string;
  baseCost: number;
  vat: number;
  shippingFee: number;
  paymentUrl?: string | null;
  paymentQrImageId?: string | null;
  discounts?: unknown[];
  vouchers?: unknown[];
  adjustmentAllocation?: AdjustmentAllocation | 'EQUAL' | 'PROPORTIONAL';
  participants: Array<{ memberId: string; originCost?: number }>;
};

/**
 * Stable hash identifying "the same bill entered twice".
 *
 * Discounts, vouchers, and participants are sorted before hashing so that
 * reordering them does not defeat duplicate detection.
 */
export const createBillFingerprint = (bill: FingerprintBill) => {
  const canonical = {
    restaurantId: bill.restaurantId,
    baseCost: bill.baseCost,
    vat: bill.vat,
    shippingFee: bill.shippingFee,
    paymentUrl: bill.paymentUrl ?? null,
    paymentQrImageId: bill.paymentQrImageId ?? null,
    discounts: [...(bill.discounts ?? [])].sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right)),
    ),
    vouchers: [...(bill.vouchers ?? [])].sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right)),
    ),
    adjustmentAllocation:
      bill.adjustmentAllocation ?? AdjustmentAllocation.PROPORTIONAL,
    participants: bill.participants
      .map(({ memberId, originCost }) => ({ memberId, originCost }))
      .sort((left, right) => left.memberId.localeCompare(right.memberId)),
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
};

/**
 * Validates the request body and runs the shared split math, producing the
 * row shape to persist. Money stays in integer cents throughout.
 */
export const computeBillCreateData = (
  body: unknown,
  createdById: string,
  fallbackAllocation = AdjustmentAllocation.PROPORTIONAL,
  legacyPaymentUrl: string | null = null,
) => {
  const parsed = billSchema.parse(body);
  const adjustmentAllocation =
    parsed.adjustmentAllocation ?? fallbackAllocation;
  const split = calculateBillSplit({ ...parsed, adjustmentAllocation });
  return {
    allowDuplicate: parsed.allowDuplicate,
    bill: {
      restaurantId: parsed.restaurantId,
      baseCost: parsed.baseCost,
      vat: parsed.vat,
      shippingFee: parsed.shippingFee,
      paymentUrl: legacyPaymentUrl,
      paymentQrImageId: parsed.paymentQrImageId ?? null,
      discounts: (parsed.discounts ?? []) as Prisma.InputJsonValue,
      vouchers: (parsed.vouchers ?? []) as Prisma.InputJsonValue,
      adjustmentAllocation,
      totalCost: split.totalCost,
      createdById,
      duplicateFingerprint: createBillFingerprint({
        ...parsed,
        adjustmentAllocation,
      }),
    },
    participants: split.participants,
  };
};

export const participantCreateData = (
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

export type PersistedParticipant = {
  memberId: string;
  originCost: number;
  allocatedVat: number;
  allocatedShipping: number;
  discountApplied: number;
  finalPrice: number;
};

/**
 * True when a recomputed split differs from what is stored. Used to keep
 * settled bills safe: an edit that does not move any allocation should not
 * reset payment state.
 */
export const participantAllocationsChanged = (
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

/** Failure carries the exact code/message the route sends, so HTTP responses are unchanged. */
export type BillValidationResult =
  { ok: true } | { ok: false; code: string; message: string };

const VALID: BillValidationResult = { ok: true };

/**
 * The subset of the Prisma client the service uses. Narrowing it this way lets
 * tests inject a stub instead of standing up a database.
 */
export type BillServiceDb = {
  paymentQrImage: {
    findFirst: (args: {
      where: { id: string; ownerId: string; status: EntryStatus };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
  };
  user: {
    count: (args: { where: { id: { in: string[] } } }) => Promise<number>;
  };
};

/**
 * A payment QR may only be attached by the member who owns it, and only while
 * it is active — otherwise a bill could point at someone else's or a retired
 * QR image.
 */
export const validatePaymentQr = async (
  paymentQrImageId: string | null | undefined,
  ownerId: string,
  db: BillServiceDb = prisma,
): Promise<BillValidationResult> => {
  if (!paymentQrImageId) return VALID;
  const qr = await db.paymentQrImage.findFirst({
    where: { id: paymentQrImageId, ownerId, status: EntryStatus.ACTIVE },
    select: { id: true },
  });
  if (qr) return VALID;
  return {
    ok: false,
    code: 'PAYMENT_QR_INVALID',
    message: 'Payment QR must be active and owned by the bill creator',
  };
};

export const validateParticipantIds = async (
  participantIds: string[],
  db: BillServiceDb = prisma,
): Promise<BillValidationResult> => {
  const userCount = await db.user.count({
    where: { id: { in: participantIds } },
  });
  if (userCount === participantIds.length) return VALID;
  return {
    ok: false,
    code: 'INVALID_PARTICIPANTS',
    message: 'One or more participants do not exist',
  };
};
