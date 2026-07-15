import { z } from 'zod';
import { AdjustmentType, parseVietnamMobilePhone } from '@ff-restaurent/shared';

export const vietnamMobilePhoneSchema = z
  .union([z.string().max(40), z.null()])
  .transform((value, context) => {
    const result = parseVietnamMobilePhone(value);
    if (!result.success) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Phone must be a valid Vietnamese mobile number',
      });
      return z.NEVER;
    }
    return result.phone;
  });

export const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

export const registerSchema = z.object({
  name: z.string().min(1),
  username: z.string().min(3).max(30),
  phone: vietnamMobilePhoneSchema.optional(),
  password: z.string().min(8),
  inviteCode: z.string().min(1),
});

export const profileUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  username: z.string().min(3).max(30).optional(),
  phone: vietnamMobilePhoneSchema.optional(),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string(),
  confirmation: z.string(),
});

export const passwordResetRequestSchema = z.object({
  identifier: z.string().trim().min(1).max(100),
});

export const passwordResetConsumeSchema = z.object({
  identifier: z.string().trim().min(1).max(100),
  code: z.string().trim().length(8),
  newPassword: z.string(),
  confirmation: z.string(),
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
  paymentUrl: z
    .string()
    .url()
    .refine((value) => value.startsWith('https://'), {
      message: 'Payment URL must use HTTPS',
    })
    .optional(),
  discounts: z.array(discountSchema).optional(),
  vouchers: z.array(voucherSchema).optional(),
  participants: z.array(participantSchema).min(2),
});

export const chefRoleSchema = z.object({
  chefRole: z.enum(['SOUS_CHEF', 'HEAD_CHEF']).nullable(),
});

export const rootAdminTransferSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  targetUsername: z.string().min(3).max(30),
  confirmationUsername: z.string().min(3).max(30),
});

export const paymentStatusSchema = z.object({
  status: z.enum(['PAID', 'WAITING']),
  expectedStatus: z.enum(['PAID', 'WAITING']),
});
