import { z } from 'zod';
import {
  AdjustmentAllocation,
  AdjustmentType,
  PAYMENT_STATUS_VALUES,
} from '@ff-restaurent/shared';

/** Bill creation, participants, adjustments, listing, and payment status. */

export const billListQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  direction: z.enum(['forward', 'backward']).default('forward'),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  sort: z
    .enum(['created-desc', 'created-asc', 'total-desc', 'total-asc'])
    .default('created-desc'),
  restaurantId: z.string().min(1).optional(),
  participantId: z.string().min(1).optional(),
  participantIds: z.string().max(4000).optional(),
  paymentStatus: z.enum(PAYMENT_STATUS_VALUES).optional(),
  archive: z.enum(['active', 'archived', 'all']).default('active'),
  ownerId: z.string().min(1).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const participantSchema = z.object({
  memberId: z.string().min(1),
  originCost: z.number().int().nonnegative().optional(),
});

export const discountSchema = z.object({
  type: z.nativeEnum(AdjustmentType),
  value: z.number().nonnegative(),
  label: z.string().optional(),
});

export const voucherSchema = z.object({
  code: z.string().min(1),
  value: z.number().int().nonnegative(),
});

export const billSchema = z.object({
  restaurantId: z.string().min(1),
  baseCost: z.number().int().nonnegative(),
  vat: z.number().int().nonnegative(),
  shippingFee: z.number().int().nonnegative(),
  paymentUrl: z
    .string()
    .url()
    .refine((value) => value.startsWith('https://'), {
      message: 'Payment URL must use HTTPS',
    })
    .optional(),
  paymentQrImageId: z.string().min(1).nullable().optional(),
  discounts: z.array(discountSchema).optional(),
  vouchers: z.array(voucherSchema).optional(),
  adjustmentAllocation: z.nativeEnum(AdjustmentAllocation).optional(),
  participants: z.array(participantSchema).min(2),
  allowDuplicate: z.boolean().default(false),
});

export const paymentStatusSchema = z.object({
  status: z.enum(PAYMENT_STATUS_VALUES),
  expectedStatus: z.enum(PAYMENT_STATUS_VALUES),
});
