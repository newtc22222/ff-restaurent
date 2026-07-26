import { z } from 'zod';

/** Restaurant feedback: half-point food and service ratings. */

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
