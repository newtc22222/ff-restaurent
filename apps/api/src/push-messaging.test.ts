import assert from 'node:assert/strict';
import test from 'node:test';
import { tokensToPrune } from './push-messaging.js';

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
  assert.deepEqual(
    tokensToPrune(['token-ok'], [{ success: true }]),
    [],
  );
});
