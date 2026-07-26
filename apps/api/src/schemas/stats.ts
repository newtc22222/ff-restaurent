import { z } from 'zod';

/** Statistics range queries, including validated custom date ranges. */

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
