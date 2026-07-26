import { z } from 'zod';

/** Collection create/update and share bodies. */

export const collectionSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).nullable().optional(),
  isPublic: z.boolean().default(false),
});

export const collectionUpdateSchema = collectionSchema.partial();

export const collectionShareSchema = z.object({
  userId: z.string().min(1),
});
