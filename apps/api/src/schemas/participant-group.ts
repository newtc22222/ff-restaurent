import { z } from 'zod';

/** Reusable participant groups. */

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
