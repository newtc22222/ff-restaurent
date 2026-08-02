import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isSafeNotificationTarget,
  productNotificationCopy,
  publishProductEvent,
} from './notification-service.js';

test('product notification targets stay inside the application', () => {
  assert.equal(isSafeNotificationTarget('/restaurants/restaurant-1'), true);
  assert.equal(isSafeNotificationTarget('//example.com/path'), false);
  assert.equal(isSafeNotificationTarget('https://example.com/path'), false);
});

test('product notification copy is localized by subscription locale', () => {
  assert.deepEqual(
    productNotificationCopy('RESTAURANT_CREATED', 'VI', {
      actorName: 'An',
      restaurantName: 'Bếp Mới',
    }),
    {
      title: 'Quán ăn mới',
      body: 'An đã thêm Bếp Mới.',
    },
  );
  assert.deepEqual(
    productNotificationCopy('COLLECTION_PUBLISHED', 'EN', {
      actorName: 'An',
      collectionName: 'Lunch picks',
    }),
    {
      title: 'New public collection',
      body: 'An published Lunch picks.',
    },
  );
});

test('publisher applies channel defaults, excludes the actor, and localizes push', async () => {
  const created: unknown[] = [];
  const deliveries: unknown[] = [];
  const sends: unknown[] = [];
  const result = await publishProductEvent(
    {
      category: 'RESTAURANT_CREATED',
      actorId: 'actor-1',
      actorName: 'An',
      targetUrl: '/restaurants/restaurant-1',
      deduplicationKey: 'restaurant-created:restaurant-1',
      data: { actorName: 'An', restaurantName: 'Bếp Mới' },
      fallbackMessage: 'An added Bếp Mới.',
    },
    { warn: () => undefined },
    {
      findAudience: async () => ['actor-1', 'user-in-app', 'user-push'],
      findPreferences: async () => [
        {
          userId: 'user-push',
          inAppEnabled: false,
          pushEnabled: true,
        },
      ],
      createNotifications: async (items) => {
        created.push(...items);
        return items.map((item) => item.userId);
      },
      findSubscriptions: async () => [
        { userId: 'user-push', fcmToken: 'token-en', locale: 'EN' },
      ],
      updateDelivery: async (...args) => {
        deliveries.push(args);
      },
      send: async (...args) => {
        sends.push(args);
        return {
          sent: 1,
          pruned: 0,
          attempted: true,
          successfulTokens: ['token-en'],
        };
      },
    },
  );

  assert.equal(result.created, 2);
  assert.deepEqual(
    created.map((item) => {
      const notification = item as {
        userId: string;
        inAppVisible: boolean;
        pushStatus: string;
      };
      return {
        userId: notification.userId,
        inAppVisible: notification.inAppVisible,
        pushStatus: notification.pushStatus,
      };
    }),
    [
      {
        userId: 'user-in-app',
        inAppVisible: true,
        pushStatus: 'NOT_REQUESTED',
      },
      {
        userId: 'user-push',
        inAppVisible: false,
        pushStatus: 'PENDING',
      },
    ],
  );
  const send = sends[0] as unknown[];
  assert.deepEqual(send.slice(0, 2), [
    ['token-en'],
    {
      title: 'New restaurant',
      body: 'An added Bếp Mới.',
      url: '/restaurants/restaurant-1',
    },
  ]);
  assert.deepEqual(deliveries, [
    [['user-push'], 'restaurant-created:restaurant-1', 'SENT'],
  ]);
});

test('publisher swallows its own failures', async () => {
  const warnings: unknown[] = [];
  const result = await publishProductEvent(
    {
      category: 'COLLECTION_PUBLISHED',
      actorId: 'actor-1',
      actorName: 'An',
      targetUrl: '/collections/collection-1',
      deduplicationKey: 'collection-published:collection-1',
      data: { actorName: 'An', collectionName: 'Lunch picks' },
      fallbackMessage: 'An published Lunch picks.',
    },
    { warn: (...args: unknown[]) => warnings.push(args) },
    {
      findAudience: async () => {
        throw new Error('database unavailable');
      },
      findPreferences: async () => [],
      createNotifications: async () => [],
      findSubscriptions: async () => [],
      updateDelivery: async () => undefined,
      send: async () => ({
        sent: 0,
        pruned: 0,
        attempted: false,
        successfulTokens: [],
      }),
    },
  );

  assert.deepEqual(result, { created: 0, pushed: 0 });
  assert.equal(warnings.length, 1);
});

test('publisher does not resend push when deduplication inserts no rows', async () => {
  let sends = 0;
  const result = await publishProductEvent(
    {
      category: 'COLLECTION_PUBLISHED',
      actorId: 'actor-1',
      actorName: 'An',
      targetUrl: '/collections/collection-1',
      deduplicationKey: 'collection-published:collection-1',
      data: { actorName: 'An', collectionName: 'Lunch picks' },
      fallbackMessage: 'An published Lunch picks.',
    },
    { warn: () => undefined },
    {
      findAudience: async () => ['user-1'],
      findPreferences: async () => [
        { userId: 'user-1', inAppEnabled: true, pushEnabled: true },
      ],
      createNotifications: async () => [],
      findSubscriptions: async () => {
        throw new Error('subscriptions should not be queried');
      },
      updateDelivery: async () => undefined,
      send: async () => {
        sends += 1;
        return {
          sent: 1,
          pruned: 0,
          attempted: true,
          successfulTokens: ['token-1'],
        };
      },
    },
  );

  assert.deepEqual(result, { created: 0, pushed: 0 });
  assert.equal(sends, 0);
});

test('publisher records delivery outcomes for each recipient', async () => {
  const deliveries: unknown[] = [];
  const result = await publishProductEvent(
    {
      category: 'RESTAURANT_CREATED',
      actorId: 'actor-1',
      actorName: 'An',
      targetUrl: '/restaurants/restaurant-1',
      deduplicationKey: 'restaurant-created:restaurant-1',
      data: { actorName: 'An', restaurantName: 'Bep Moi' },
      fallbackMessage: 'An added Bep Moi.',
    },
    { warn: () => undefined },
    {
      findAudience: async () => ['user-sent', 'user-failed'],
      findPreferences: async () => [
        { userId: 'user-sent', inAppEnabled: true, pushEnabled: true },
        { userId: 'user-failed', inAppEnabled: true, pushEnabled: true },
      ],
      createNotifications: async (items) => items.map((item) => item.userId),
      findSubscriptions: async () => [
        { userId: 'user-sent', fcmToken: 'token-sent', locale: 'EN' },
        { userId: 'user-failed', fcmToken: 'token-failed', locale: 'EN' },
      ],
      updateDelivery: async (...args) => {
        deliveries.push(args);
      },
      send: async () => ({
        sent: 1,
        pruned: 0,
        attempted: true,
        successfulTokens: ['token-sent'],
      }),
    },
  );

  assert.deepEqual(result, { created: 2, pushed: 1 });
  assert.deepEqual(deliveries, [
    [['user-sent'], 'restaurant-created:restaurant-1', 'SENT'],
    [['user-failed'], 'restaurant-created:restaurant-1', 'FAILED'],
  ]);
});
