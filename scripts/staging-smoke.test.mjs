import assert from 'node:assert/strict';
import test from 'node:test';
import { expectOk } from './staging-smoke.mjs';

test('smoke retries bounded transient failures', async () => {
  let calls = 0;
  const value = await expectOk('https://example.test/health', undefined, {
    attempts: 3,
    timeoutMs: 10,
    delayMs: 0,
    sleep: async () => {},
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) throw new Error('cold start timeout');
      return new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });
  assert.deepEqual(value, { status: 'ok' });
  assert.equal(calls, 2);
});

test('smoke does not retry a permanent client response', async () => {
  let calls = 0;
  await assert.rejects(
    expectOk('https://example.test/auth', undefined, {
      attempts: 3,
      timeoutMs: 10,
      delayMs: 0,
      sleep: async () => {},
      fetchImpl: async () => {
        calls += 1;
        return new Response('', { status: 401 });
      },
    }),
    /returned 401/,
  );
  assert.equal(calls, 1);
});
