import { z } from 'zod';

import { COLLECTION_SYSTEM_TYPE_VALUES } from '@ff-restaurent/shared';

import { validateStructuredAddress, vietnamAddressShape } from './common.js';

/** Cuisine and dining-area catalogs, plus the shared catalog list query. */

export const cuisineSchema = z.object({
  name: z.string().trim().min(1).max(80),
  type: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).nullable().optional(),
});
export const cuisineUpdateSchema = cuisineSchema.partial();

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
  direction: z.enum(['forward', 'backward']).default('forward'),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  sort: z
    .enum(['name-asc', 'name-desc', 'created-desc', 'created-asc'])
    .default('name-asc'),
  type: z.string().trim().max(80).optional(),
  provinceCode: z.string().trim().max(64).optional(),
  visibility: z.enum(['all', 'owned', 'public', 'shared']).default('all'),
  systemType: z.enum([...COLLECTION_SYSTEM_TYPE_VALUES, 'custom']).optional(),
});
