import { z } from 'zod';

import { isoDateOnlySchema } from './common.js';

/** Statistics range queries, including validated custom date ranges. */

export const statsQuerySchema = z
  .object({
    range: z.enum(['weekly', 'monthly', 'yearly', 'custom']).default('monthly'),
    from: isoDateOnlySchema.optional(),
    to: isoDateOnlySchema.optional(),
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
