import { z } from 'zod';
import { AdjustmentType } from '@ff-restaurent/shared';

export const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

export const registerSchema = z.object({
  name: z.string().min(1),
  username: z.string().min(3).max(30),
  phone: z.string().optional(),
  password: z.string().min(8),
});

export const profileUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  username: z.string().min(3).max(30).optional(),
  phone: z.string().optional(),
});

export const restaurantSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  cuisineType: z.string().min(1),
  type: z.string().min(1),
  avatarUrl: z.string().optional(),
  links: z
    .array(z.object({ label: z.string().optional(), url: z.string().url() }))
    .optional(),
  isRecommended: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
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
  discounts: z.array(discountSchema).optional(),
  vouchers: z.array(voucherSchema).optional(),
  participants: z.array(participantSchema).min(2),
});

export const chefRoleSchema = z.object({
  chefRole: z.enum(['SOUS_CHEF', 'HEAD_CHEF']).nullable(),
});
