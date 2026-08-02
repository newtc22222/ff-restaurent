import assert from 'node:assert/strict';
import test from 'node:test';

import { buildApp } from '../app.js';
import {
  getActiveNotificationStreamCount,
  parseNotificationCursor,
  serializeNotificationCursor,
  streamNotificationEvents,
} from './notification-stream.js';

const cursor = (createdAt: string, id: string) => ({
  createdAt: new Date(createdAt),
  id,
});

test('notification cursors round-trip and reject malformed values', () => {
  const value = cursor('2026-08-02T10:00:00.000Z', 'notification-1');

  assert.deepEqual(
    parseNotificationCursor(serializeNotificationCursor(value)),
    value,
  );
  assert.equal(parseNotificationCursor('not-a-cursor'), null);
  assert.equal(parseNotificationCursor('not-a-date|notification-1'), null);
  assert.equal(parseNotificationCursor('2026-08-02T10:00:00.000Z|'), null);
});

test('the notification stream endpoint requires authentication', async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: 'GET',
    url: '/notifications/stream',
  });
  await app.close();

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().code, 'AUTHENTICATION_REQUIRED');
});

test('the notification stream allows the browser cursor header', async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: 'OPTIONS',
    url: '/notifications/stream',
    headers: {
      origin: 'http://localhost:5173',
      'access-control-request-method': 'GET',
      'access-control-request-headers': 'authorization,last-event-id',
    },
  });
  await app.close();

  assert.equal(response.statusCode, 204);
  assert.match(
    response.headers['access-control-allow-headers'] ?? '',
    /Last-Event-ID/i,
  );
});

test('notification streams start after the latest snapshot and preserve ownership', async () => {
  const controller = new AbortController();
  const baseline = cursor('2026-08-02T10:00:00.000Z', 'baseline');
  const created = cursor('2026-08-02T10:00:01.000Z', 'notification-1');
  const ready: Array<string | null> = [];
  const events: Array<{ notificationId: string; cursor: string }> = [];

  await streamNotificationEvents(
    {
      userId: 'user-1',
      signal: controller.signal,
      handlers: {
        ready: (value) => ready.push(value),
        notification: (event) => {
          events.push(event);
          controller.abort();
        },
        heartbeat: () => undefined,
      },
    },
    {
      latest: async (userId) => {
        assert.equal(userId, 'user-1');
        return baseline;
      },
      after: async (userId, value) => {
        assert.equal(userId, 'user-1');
        assert.deepEqual(value, baseline);
        return [created];
      },
      delay: async () => undefined,
      now: () => 0,
    },
  );

  assert.deepEqual(ready, [serializeNotificationCursor(baseline)]);
  assert.deepEqual(events, [
    {
      notificationId: created.id,
      cursor: serializeNotificationCursor(created),
    },
  ]);
});

test('notification streams recover from the supplied creation cursor', async () => {
  const controller = new AbortController();
  const previous = cursor('2026-08-02T10:00:00.000Z', 'notification-1');
  const recovered = cursor('2026-08-02T10:00:00.000Z', 'notification-2');
  const events: string[] = [];

  await streamNotificationEvents(
    {
      userId: 'user-1',
      lastEventId: serializeNotificationCursor(previous),
      signal: controller.signal,
      handlers: {
        ready: () => undefined,
        notification: ({ notificationId }) => {
          events.push(notificationId);
          controller.abort();
        },
        heartbeat: () => undefined,
      },
    },
    {
      latest: async () => assert.fail('cursor recovery must not rebaseline'),
      after: async (_userId, value) => {
        assert.deepEqual(value, previous);
        return [recovered];
      },
      delay: async () => undefined,
      now: () => 0,
    },
  );

  assert.deepEqual(events, ['notification-2']);
});

test('notification streams stop promptly and release active state on disconnect', async () => {
  const controller = new AbortController();
  let querying = false;
  const stream = streamNotificationEvents(
    {
      userId: 'user-1',
      signal: controller.signal,
      handlers: {
        ready: () => undefined,
        notification: () => undefined,
        heartbeat: () => undefined,
      },
    },
    {
      latest: async () => null,
      after: async () => {
        querying = true;
        return [];
      },
      delay: (_milliseconds, signal) =>
        new Promise((resolve) =>
          signal.addEventListener('abort', () => resolve(), { once: true }),
        ),
      now: () => 0,
    },
  );

  while (!querying) await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(getActiveNotificationStreamCount(), 1);
  controller.abort();
  await stream;
  assert.equal(getActiveNotificationStreamCount(), 0);
});

test('notification streams send heartbeat frames while idle', async () => {
  const controller = new AbortController();
  let now = 0;
  let heartbeats = 0;

  await streamNotificationEvents(
    {
      userId: 'user-1',
      signal: controller.signal,
      handlers: {
        ready: () => undefined,
        notification: () => undefined,
        heartbeat: () => {
          heartbeats += 1;
          controller.abort();
        },
      },
    },
    {
      latest: async () => null,
      after: async () => {
        now = 15_000;
        return [];
      },
      delay: async () => undefined,
      now: () => now,
    },
  );

  assert.equal(heartbeats, 1);
});

test('notification streams end after a bounded lifetime so sessions reauthenticate', async () => {
  let now = 0;

  await streamNotificationEvents(
    {
      userId: 'user-1',
      signal: new AbortController().signal,
      handlers: {
        ready: () => undefined,
        notification: () => undefined,
        heartbeat: () => undefined,
      },
    },
    {
      latest: async () => null,
      after: async () => {
        now = 60_000;
        return [];
      },
      delay: async () => assert.fail('expired streams must not keep polling'),
      now: () => now,
    },
  );
});
