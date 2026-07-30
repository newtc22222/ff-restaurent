import { z } from 'zod';

/** Per-user notification preferences. */

export const notificationPreferenceSchema = z.object({
  paymentRemindersEnabled: z.boolean(),
});
