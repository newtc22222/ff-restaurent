import { z } from 'zod';

/** Per-user notification preferences. */

const productNotificationCategorySchema = z.enum([
  'RESTAURANT_CREATED',
  'COLLECTION_PUBLISHED',
]);

export const notificationPreferenceSchema = z.object({
  paymentRemindersEnabled: z.boolean().optional(),
  categories: z
    .array(
      z.object({
        category: productNotificationCategorySchema,
        inAppEnabled: z.boolean(),
        pushEnabled: z.boolean(),
      }),
    )
    .optional(),
});

export const pushSubscriptionSchema = z.object({
  fcmToken: z.string().min(1).max(4096),
  locale: z.enum(['vi', 'en']).default('vi'),
});
