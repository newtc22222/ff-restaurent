import assert from 'node:assert/strict';
import test from 'node:test';

import {
  notificationPreferenceSchema,
  pushSubscriptionSchema,
} from './index.js';

test('notification preferences accept sparse product category overrides', () => {
  assert.deepEqual(
    notificationPreferenceSchema.parse({
      categories: [
        {
          category: 'RESTAURANT_CREATED',
          inAppEnabled: false,
          pushEnabled: true,
        },
      ],
    }),
    {
      categories: [
        {
          category: 'RESTAURANT_CREATED',
          inAppEnabled: false,
          pushEnabled: true,
        },
      ],
    },
  );
  assert.throws(() =>
    notificationPreferenceSchema.parse({
      categories: [
        {
          category: 'MEAL_VOTE_CREATED',
          inAppEnabled: true,
          pushEnabled: true,
        },
      ],
    }),
  );
});

test('push subscription locale defaults to Vietnamese', () => {
  assert.deepEqual(pushSubscriptionSchema.parse({ fcmToken: 'token-1' }), {
    fcmToken: 'token-1',
    locale: 'vi',
  });
  assert.equal(
    pushSubscriptionSchema.parse({ fcmToken: 'token-1', locale: 'en' }).locale,
    'en',
  );
});
