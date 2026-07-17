import { z } from 'zod';
import {
  AdjustmentAllocation,
  AdjustmentType,
  parseVietnamMobilePhone,
} from '@ff-restaurent/shared';

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

const normalizePlatformUrl = (value: string) => {
  const url = new URL(value);
  url.hash = '';
  return url.toString();
};

const httpsUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => new URL(value).protocol === 'https:', {
    message: 'URL must use HTTPS',
  })
  .transform(normalizePlatformUrl);

const optionalHttpsUrlSchema = z
  .union([httpsUrlSchema, z.literal(''), z.null()])
  .transform((value) => (value ? value : null));

const legacyUrlSchema = z.string().trim().url().transform(normalizePlatformUrl);

export const restaurantPlatformLinkSchema = z
  .object({
    platform: z.enum([
      'GRAB',
      'SHOPEE_FOOD',
      'BE_FOOD',
      'GOJEK',
      'WEBSITE',
      'FACEBOOK',
      'OTHER',
    ]),
    label: z.string().trim().max(60).nullable().optional(),
    url: httpsUrlSchema,
  })
  .superRefine((value, context) => {
    if (value.platform === 'OTHER' && !value.label) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['label'],
        message: 'OTHER platform links require a custom label',
      });
    }
  })
  .transform((value) => ({
    ...value,
    label: value.platform === 'OTHER' ? value.label : null,
  }));

type RestaurantProfileInput = {
  platformLinks?: Array<z.infer<typeof restaurantPlatformLinkSchema>>;
  links?: Array<{ label?: string; url: string }>;
};

const validatePlatformLinks = (
  value: RestaurantProfileInput,
  context: z.RefinementCtx,
) => {
  if (value.platformLinks && value.links) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['platformLinks'],
      message: 'Use platformLinks instead of sending both link formats',
    });
  }
  const platformLinks =
    value.platformLinks ??
    value.links?.map((link) => ({
      platform: 'OTHER' as const,
      label: link.label || 'Legacy link',
      url: link.url,
    }));
  const urls = new Set<string>();
  const exclusivePlatforms = new Set<string>();
  for (const [index, link] of (platformLinks ?? []).entries()) {
    const normalizedUrl = link.url.toLocaleLowerCase();
    if (urls.has(normalizedUrl)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['platformLinks', index, 'url'],
        message: 'Platform link URLs must be unique per restaurant',
      });
    }
    urls.add(normalizedUrl);

    if (link.platform !== 'OTHER') {
      if (exclusivePlatforms.has(link.platform)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['platformLinks', index, 'platform'],
          message: 'Only one link is allowed for each named platform',
        });
      }
      exclusivePlatforms.add(link.platform);
    }
  }
};

const migrateLegacyPlatformLinks = <T extends RestaurantProfileInput>(
  value: T,
) => {
  const { links, ...current } = value;
  if (current.platformLinks || !links) return current;
  return {
    ...current,
    platformLinks: links.map((link) => ({
      platform: 'OTHER' as const,
      label: link.label || 'Legacy link',
      url: link.url,
    })),
  };
};

const restaurantObjectSchema = z.object({
  ...vietnamAddressShape,
  name: z.string().min(1),
  cuisineType: z.string().min(1),
  cuisineIds: z.array(z.string().min(1)).min(1).max(20).optional(),
  primaryCuisineId: z.string().min(1).optional(),
  diningAreaId: z.string().min(1).nullable().optional(),
  type: z.string().min(1),
  avatarUrl: z.string().optional(),
  phone: vietnamMobilePhoneSchema.optional(),
  bannerImageUrl: optionalHttpsUrlSchema.optional(),
  platformLinks: z.array(restaurantPlatformLinkSchema).max(20).optional(),
  links: z
    .array(
      z.object({
        label: z.string().trim().max(60).optional(),
        url: legacyUrlSchema,
      }),
    )
    .max(20)
    .optional(),
  isRecommended: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
});

type RestaurantCatalogInput = {
  cuisineIds?: string[];
  primaryCuisineId?: string;
};

const validateRestaurantCatalogs = (
  value: RestaurantCatalogInput,
  context: z.RefinementCtx,
) => {
  if (!value.cuisineIds && !value.primaryCuisineId) return;
  if (!value.cuisineIds || !value.primaryCuisineId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['cuisineIds'],
      message:
        'Cuisine selection and primary cuisine must be supplied together',
    });
    return;
  }
  if (new Set(value.cuisineIds).size !== value.cuisineIds.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['cuisineIds'],
      message: 'Cuisine selections must be unique',
    });
  }
  if (!value.cuisineIds.includes(value.primaryCuisineId)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['primaryCuisineId'],
      message: 'Primary cuisine must be one of the selected cuisines',
    });
  }
};

export const restaurantSchema = restaurantObjectSchema
  .superRefine(validateStructuredAddress)
  .superRefine(validatePlatformLinks)
  .superRefine(validateRestaurantCatalogs)
  .transform(migrateLegacyPlatformLinks);
export const restaurantUpdateSchema = restaurantObjectSchema
  .partial()
  .superRefine(validateStructuredAddress)
  .superRefine(validatePlatformLinks)
  .superRefine(validateRestaurantCatalogs)
  .transform(migrateLegacyPlatformLinks);

export const cuisineSchema = z.object({
  name: z.string().trim().min(1).max(80),
  type: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).nullable().optional(),
});

const diningAreaObjectSchema = z.object({
  ...vietnamAddressShape,
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).nullable().optional(),
});

export const diningAreaSchema = diningAreaObjectSchema.superRefine(
  validateStructuredAddress,
);
export const diningAreaUpdateSchema = diningAreaObjectSchema
  .partial()
  .superRefine(validateStructuredAddress);

export const catalogQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  sort: z
    .enum(['name-asc', 'name-desc', 'created-desc', 'created-asc'])
    .default('name-asc'),
  type: z.string().trim().max(80).optional(),
  provinceCode: z.string().trim().max(20).optional(),
  visibility: z.enum(['all', 'owned', 'public', 'shared']).default('all'),
  systemType: z.enum(['FAVORITES', 'RECOMMENDED', 'custom']).optional(),
});

export const memberQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.enum(['name-asc', 'name-desc', 'created-desc']).default('name-asc'),
});

export const billListQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  sort: z
    .enum(['created-desc', 'created-asc', 'total-desc', 'total-asc'])
    .default('created-desc'),
  restaurantId: z.string().min(1).optional(),
  participantId: z.string().min(1).optional(),
  participantIds: z.string().max(4000).optional(),
  paymentStatus: z.enum(['PAID', 'WAITING']).optional(),
  archive: z.enum(['active', 'archived', 'all']).default('active'),
  ownerId: z.string().min(1).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const restaurantListQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  sort: z
    .enum(['name-asc', 'name-desc', 'created-desc', 'created-asc'])
    .default('name-asc'),
  cuisineId: z.string().min(1).optional(),
  primaryCuisineId: z.string().min(1).optional(),
  diningAreaId: z.string().min(1).optional(),
  collectionId: z.string().min(1).optional(),
  platform: z
    .enum([
      'GRAB',
      'SHOPEE_FOOD',
      'BE_FOOD',
      'GOJEK',
      'WEBSITE',
      'FACEBOOK',
      'OTHER',
    ])
    .optional(),
  archive: z.enum(['active', 'archived', 'all']).default('active'),
  favorite: z.enum(['true', 'false']).optional(),
  recommended: z.enum(['true', 'false']).optional(),
});

export const collectionSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).nullable().optional(),
  isPublic: z.boolean().default(false),
});

export const collectionUpdateSchema = collectionSchema.partial();

export const collectionShareSchema = z.object({
  userId: z.string().min(1),
});

export const participantGroupSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    memberIds: z.array(z.string().min(1)).min(2).max(100),
  })
  .superRefine((value, context) => {
    if (new Set(value.memberIds).size !== value.memberIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['memberIds'],
        message: 'Participant group members must be unique',
      });
    }
  });

export const notificationPreferenceSchema = z.object({
  paymentRemindersEnabled: z.boolean(),
});

const halfPointRatingSchema = z
  .number()
  .min(1)
  .max(10)
  .refine((value) => Number.isInteger(value * 2), {
    message: 'Rating must use 0.5-point increments',
  });

export const feedbackSchema = z.object({
  foodRating: halfPointRatingSchema,
  serviceRating: halfPointRatingSchema,
  comment: z.string().trim().max(2000).nullable().optional(),
});

export const feedbackQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
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
  adjustmentAllocation: z.nativeEnum(AdjustmentAllocation).optional(),
  participants: z.array(participantSchema).min(2),
  allowDuplicate: z.boolean().default(false),
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
