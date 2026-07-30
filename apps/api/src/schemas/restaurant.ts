import { z } from 'zod';

import { RESTAURANT_PLATFORM_VALUES } from '@ff-restaurent/shared';

import {
  httpsUrlSchema,
  legacyUrlSchema,
  optionalHttpsUrlSchema,
  validateStructuredAddress,
  vietnamAddressShape,
  vietnamMobilePhoneSchema,
} from './common.js';

/**
 * Restaurant profile, platform links, and directory queries.
 *
 * The deprecated `links` input is still accepted and migrated into
 * `platformLinks` — a Phase 2 contract guarantee for existing clients.
 */

export const restaurantPlatformLinkSchema = z
  .object({
    platform: z.enum(RESTAURANT_PLATFORM_VALUES),
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
  cuisineType: z.string().min(1).optional(),
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
  collectionIds: z
    .array(z.string().min(1))
    .max(100)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: 'Collection selections must be unique',
    })
    .optional(),
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
  .superRefine((value, context) => {
    if (value.cuisineType || (value.cuisineIds && value.primaryCuisineId))
      return;
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['cuisineIds'],
      message: 'At least one cuisine and a primary cuisine are required',
    });
  })
  .transform(migrateLegacyPlatformLinks);
export const restaurantUpdateSchema = restaurantObjectSchema
  .partial()
  .superRefine(validateStructuredAddress)
  .superRefine(validatePlatformLinks)
  .superRefine(validateRestaurantCatalogs)
  .transform(migrateLegacyPlatformLinks);

export const restaurantListQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  cursor: z.string().min(1).optional(),
  direction: z.enum(['forward', 'backward']).default('forward'),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  sort: z
    .enum(['name-asc', 'name-desc', 'created-desc', 'created-asc'])
    .default('name-asc'),
  cuisineId: z.string().min(1).optional(),
  primaryCuisineId: z.string().min(1).optional(),
  diningAreaId: z.string().min(1).optional(),
  collectionId: z.string().min(1).optional(),
  platform: z.enum(RESTAURANT_PLATFORM_VALUES).optional(),
  archive: z.enum(['active', 'archived', 'all']).default('active'),
  favorite: z.enum(['true', 'false']).optional(),
  recommended: z.enum(['true', 'false']).optional(),
});

export const restaurantCollectionsSchema = z.object({
  collectionIds: z
    .array(z.string().min(1))
    .max(100)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: 'Collection selections must be unique',
    }),
});
