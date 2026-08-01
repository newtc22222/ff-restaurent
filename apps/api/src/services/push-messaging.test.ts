import assert from 'node:assert/strict';
import test from 'node:test';

import { sendReminderPushForUsers, tokensToPrune } from './push-messaging.js';

test('tokensToPrune keeps only unregistered tokens for removal', () => {
  const tokens = ['token-ok', 'token-stale', 'token-other-error'];
  const responses = [
    { success: true },
    {
      success: false,
      error: { code: 'messaging/registration-token-not-registered' },
    },
    { success: false, error: { code: 'messaging/internal-error' } },
  ];
  assert.deepEqual(tokensToPrune(tokens, responses), ['token-stale']);
});

test('tokensToPrune returns an empty array when nothing is stale', () => {
  assert.deepEqual(tokensToPrune(['token-ok'], [{ success: true }]), []);
});

test('sendReminderPushForUsers swallows subscription lookup failures', async () => {
  const warnings: unknown[] = [];
  const result = await sendReminderPushForUsers(
    ['user-1'],
    { title: 'Reminder', body: 'Open the app', url: '/bills/bill-1' },
    { warn: (...args: unknown[]) => warnings.push(args) },
    {
      findTokens: async () => {
        throw new Error('database unavailable');
      },
      send: async () => {
        throw new Error('send should not run');
      },
    },
  );

  assert.deepEqual(result, { sent: 0, pruned: 0 });
  assert.equal(warnings.length, 1);
});
