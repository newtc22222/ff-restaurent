import { z } from 'zod';

/** Per-user notification preferences. */

export const notificationPreferenceSchema = z.object({
  paymentRemindersEnabled: z.boolean(),
});

export const pushSubscriptionSchema = z.object({
  fcmToken: z.string().min(1).max(4096),
});
