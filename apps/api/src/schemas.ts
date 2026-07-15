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

const vietnamAddressShape = {
  address: z.string().trim().min(1),
  addressLine: z.string().trim().min(1).nullable().optional(),
  provinceCode: z.string().trim().min(1).nullable().optional(),
  provinceName: z.string().trim().min(1).nullable().optional(),
  wardCode: z.string().trim().min(1).nullable().optional(),
  wardName: z.string().trim().min(1).nullable().optional(),
};

const validateStructuredAddress = (
  value: Partial<z.infer<z.ZodObject<typeof vietnamAddressShape>>>,
  context: z.RefinementCtx,
) => {
  const structured = [
    value.addressLine,
    value.provinceCode,
    value.provinceName,
    value.wardCode,
    value.wardName,
  ];
  const supplied = structured.filter(
    (part) => typeof part === 'string' && part.length > 0,
  ).length;
  if (supplied !== 0 && supplied !== structured.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['address'],
      message:
        'Structured addresses require an address line, province, and ward',
    });
  }
};

type VietnamAddressInput = Partial<
  Record<keyof typeof vietnamAddressShape, string | null | undefined>
>;

/** Builds the display snapshot server-side or clears stale structure for manual input. */
export const normalizeVietnamAddressSnapshot = <T extends VietnamAddressInput>(
  value: T,
): T => {
  const structured = [value.addressLine, value.wardName, value.provinceName];
  if (structured.every((part) => typeof part === 'string' && part.length > 0)) {
    return { ...value, address: structured.join(', ') };
  }
  if (value.address !== undefined) {
    return {
      ...value,
      addressLine: null,
      provinceCode: null,
      provinceName: null,
      wardCode: null,
      wardName: null,
    };
  }
  return value;
};

export const vietnamAddressSchema = z
  .object(vietnamAddressShape)
  .superRefine(validateStructuredAddress);

const restaurantObjectSchema = z.object({
  ...vietnamAddressShape,
  name: z.string().min(1),
  cuisineType: z.string().min(1),
  type: z.string().min(1),
  avatarUrl: z.string().optional(),
  links: z
    .array(z.object({ label: z.string().optional(), url: z.string().url() }))
    .optional(),
  isRecommended: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
});

export const restaurantSchema = restaurantObjectSchema.superRefine(
  validateStructuredAddress,
);
export const restaurantUpdateSchema = restaurantObjectSchema
  .partial()
  .superRefine(validateStructuredAddress);

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

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a date in YYYY-MM-DD format')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  }, 'Expected a valid calendar date');

export const statsQuerySchema = z
  .object({
    range: z.enum(['weekly', 'monthly', 'yearly', 'custom']).default('monthly'),
    from: dateOnlySchema.optional(),
    to: dateOnlySchema.optional(),
  })
  .superRefine((value, context) => {
    if (value.range !== 'custom') return;

    if (!value.from) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['from'],
        message: 'A custom range requires a start date',
      });
    }
    if (!value.to) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['to'],
        message: 'A custom range requires an end date',
      });
    }
    if (value.from && value.to && value.from > value.to) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['to'],
        message: 'The end date must be on or after the start date',
      });
    }
  });
