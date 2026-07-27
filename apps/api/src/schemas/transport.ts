import { z } from 'zod';
import {
  ADJUSTMENT_ALLOCATION_VALUES,
  ADJUSTMENT_TYPE_VALUES,
  CHEF_ROLE_VALUES,
  COLLECTION_SYSTEM_TYPE_VALUES,
  ENTRY_STATUS_VALUES,
  PAYMENT_STATUS_VALUES,
  RESTAURANT_PLATFORM_VALUES,
  SYSTEM_ROLE_VALUES,
} from '@ff-restaurent/shared';

/**
 * Serialized API response contracts.
 *
 * Response objects remain passthrough so adding these schemas cannot remove a
 * compatibility field from the wire. The named schemas below are also the
 * OpenAPI components consumed by the generated web transport layer.
 */

export const chefRoleResponseSchema = z.enum(CHEF_ROLE_VALUES);
export const systemRoleResponseSchema = z.enum(SYSTEM_ROLE_VALUES);
export const entryStatusResponseSchema = z.enum(ENTRY_STATUS_VALUES);
export const paymentStatusResponseSchema = z.enum(PAYMENT_STATUS_VALUES);
export const adjustmentTypeResponseSchema = z.enum(ADJUSTMENT_TYPE_VALUES);
export const adjustmentAllocationResponseSchema = z.enum(
  ADJUSTMENT_ALLOCATION_VALUES,
);
export const restaurantPlatformResponseSchema = z.enum(
  RESTAURANT_PLATFORM_VALUES,
);
export const collectionSystemTypeResponseSchema = z.enum(
  COLLECTION_SYSTEM_TYPE_VALUES,
);

const serializedDateSchema = z.coerce.date();
const nullableStringSchema = z.string().nullable();

export const errorResponseSchema = z
  .object({
    code: z.string().optional(),
    message: z.string(),
  })
  .passthrough();

export const publicUserSummaryResponseSchema = z
  .object({
    id: z.string(),
    username: z.string(),
    name: z.string(),
  })
  .passthrough();

export const userResponseSchema = publicUserSummaryResponseSchema
  .extend({
    phone: nullableStringSchema.optional(),
    avatarUrl: nullableStringSchema.optional(),
    chefRole: chefRoleResponseSchema.nullable(),
    systemRole: systemRoleResponseSchema.nullable(),
    roles: z.array(z.string()),
    paymentRemindersEnabled: z.boolean().optional(),
    createdAt: serializedDateSchema.optional(),
  })
  .passthrough();

export const restaurantPlatformLinkResponseSchema = z
  .object({
    id: z.string().optional(),
    platform: restaurantPlatformResponseSchema,
    label: nullableStringSchema.optional(),
    url: z.string(),
    sortOrder: z.number().int().optional(),
  })
  .passthrough();

export const cuisineResponseSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    description: nullableStringSchema.optional(),
  })
  .passthrough();

export const diningAreaResponseSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    address: z.string(),
    addressLine: nullableStringSchema.optional(),
    provinceCode: nullableStringSchema.optional(),
    provinceName: nullableStringSchema.optional(),
    wardCode: nullableStringSchema.optional(),
    wardName: nullableStringSchema.optional(),
    description: nullableStringSchema.optional(),
  })
  .passthrough();

export const feedbackAggregatesResponseSchema = z
  .object({
    foodRating: z.number().nullable(),
    serviceRating: z.number().nullable(),
    feedbackCount: z.number().int(),
  })
  .passthrough();

export const restaurantEntryResponseSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    address: z.string(),
    addressLine: nullableStringSchema.optional(),
    provinceCode: nullableStringSchema.optional(),
    provinceName: nullableStringSchema.optional(),
    wardCode: nullableStringSchema.optional(),
    wardName: nullableStringSchema.optional(),
    phone: nullableStringSchema.optional(),
    bannerImageUrl: nullableStringSchema.optional(),
    diningAreaId: nullableStringSchema.optional(),
    diningArea: diningAreaResponseSchema.nullable().optional(),
    cuisineType: z.string(),
    type: z.string(),
    avatarUrl: nullableStringSchema.optional(),
    platformLinks: z.array(restaurantPlatformLinkResponseSchema).optional(),
    cuisines: z
      .array(
        z
          .object({
            isPrimary: z.boolean(),
            cuisine: cuisineResponseSchema,
          })
          .passthrough(),
      )
      .optional(),
    isRecommended: z.boolean(),
    isFavorite: z.boolean(),
    isFavoritedByMe: z.boolean().optional(),
    status: entryStatusResponseSchema,
    feedbackAggregates: feedbackAggregatesResponseSchema.optional(),
    createdById: z.string().optional(),
    createdAt: serializedDateSchema.optional(),
    updatedAt: serializedDateSchema.optional(),
  })
  .passthrough();

export const pageInfoResponseSchema = z
  .object({
    startCursor: nullableStringSchema.optional(),
    endCursor: nullableStringSchema,
    hasPreviousPage: z.boolean().optional(),
    hasNextPage: z.boolean(),
  })
  .passthrough();

export const collectionResponseSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: nullableStringSchema.optional(),
    isPublic: z.boolean(),
    systemType: collectionSystemTypeResponseSchema.nullable(),
    ownerId: nullableStringSchema.optional(),
    owner: publicUserSummaryResponseSchema.nullable().optional(),
    _count: z
      .object({
        restaurants: z.number().int(),
        shares: z.number().int(),
      })
      .passthrough(),
    createdAt: serializedDateSchema,
    updatedAt: serializedDateSchema,
  })
  .passthrough();

export const billParticipantResponseSchema = z
  .object({
    memberId: z.string(),
    member: userResponseSchema,
    originCost: z.number().int(),
    allocatedVat: z.number().int(),
    allocatedShipping: z.number().int(),
    discountApplied: z.number().int(),
    finalPrice: z.number().int(),
    paymentStatus: paymentStatusResponseSchema,
    paidAt: serializedDateSchema.nullable().optional(),
  })
  .passthrough();

export const paymentQrImageSummaryResponseSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    status: entryStatusResponseSchema,
    imageUrl: z.string(),
  })
  .passthrough();

export const billResponseSchema = z
  .object({
    id: z.string(),
    restaurant: restaurantEntryResponseSchema,
    createdById: z.string(),
    createdBy: userResponseSchema,
    baseCost: z.number().int(),
    vat: z.number().int(),
    shippingFee: z.number().int(),
    totalCost: z.number().int(),
    discounts: z.array(
      z
        .object({
          type: adjustmentTypeResponseSchema,
          value: z.number(),
          label: z.string().optional(),
        })
        .passthrough(),
    ),
    vouchers: z.array(
      z
        .object({
          code: z.string(),
          value: z.number().int(),
        })
        .passthrough(),
    ),
    adjustmentAllocation: adjustmentAllocationResponseSchema,
    qrCodePath: nullableStringSchema.optional(),
    paymentUrl: nullableStringSchema.optional(),
    paymentQrImageId: nullableStringSchema.optional(),
    paymentQrImage: paymentQrImageSummaryResponseSchema.nullable().optional(),
    status: entryStatusResponseSchema,
    createdAt: serializedDateSchema,
    updatedAt: serializedDateSchema,
    participants: z.array(billParticipantResponseSchema),
  })
  .passthrough();

export const authSessionResponseSchema = z
  .object({
    token: z.string(),
    user: userResponseSchema,
  })
  .passthrough();

export const openApiComponentSchemas = {
  ChefRole: chefRoleResponseSchema,
  SystemRole: systemRoleResponseSchema,
  EntryStatus: entryStatusResponseSchema,
  PaymentStatus: paymentStatusResponseSchema,
  AdjustmentType: adjustmentTypeResponseSchema,
  AdjustmentAllocation: adjustmentAllocationResponseSchema,
  RestaurantPlatform: restaurantPlatformResponseSchema,
  CollectionSystemType: collectionSystemTypeResponseSchema,
  User: userResponseSchema,
  RestaurantEntry: restaurantEntryResponseSchema,
  Bill: billResponseSchema,
  Collection: collectionResponseSchema,
} as const;
