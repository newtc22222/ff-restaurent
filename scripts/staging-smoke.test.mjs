import assert from 'node:assert/strict';
import test from 'node:test';
import { expectOk, runSmoke } from './staging-smoke.mjs';

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

test('smoke keeps Cloud Run identity separate from application JWT authorization', async () => {
  const originalFetch = globalThis.fetch;
  const changedEnvironment = [
    'API_URL',
    'WEB_URL',
    'API_CLOUD_RUN_IDENTITY_TOKEN',
    'WEB_CLOUD_RUN_IDENTITY_TOKEN',
    'SMOKE_USERNAME',
    'SMOKE_PASSWORD',
    'SMOKE_ATTEMPTS',
  ];
  const originalEnvironment = Object.fromEntries(
    changedEnvironment.map((name) => [name, process.env[name]]),
  );
  const requests = [];
  process.env.API_URL = 'https://api.example.test';
  process.env.WEB_URL = 'https://web.example.test';
  process.env.API_CLOUD_RUN_IDENTITY_TOKEN = 'api-identity-token';
  process.env.WEB_CLOUD_RUN_IDENTITY_TOKEN = 'web-identity-token';
  process.env.SMOKE_USERNAME = 'operator';
  process.env.SMOKE_PASSWORD = 'not-logged';
  process.env.SMOKE_ATTEMPTS = '1';
  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), headers: new Headers(init.headers) });
    if (String(url).endsWith('/auth/login')) {
      return Response.json({ token: 'application-jwt' });
    }
    return Response.json({ status: 'ok' });
  };

  try {
    await runSmoke();
  } finally {
    globalThis.fetch = originalFetch;
    for (const name of changedEnvironment) {
      if (originalEnvironment[name] === undefined) delete process.env[name];
      else process.env[name] = originalEnvironment[name];
    }
  }

  const apiRequests = requests.filter(({ url }) =>
    url.startsWith('https://api.example.test'),
  );
  assert.ok(
    apiRequests.every(
      ({ headers }) =>
        headers.get('x-serverless-authorization') ===
        'Bearer api-identity-token',
    ),
  );
  assert.equal(
    requests
      .find(({ url }) => url === 'https://web.example.test')
      .headers.get('x-serverless-authorization'),
    'Bearer web-identity-token',
  );
  for (const path of ['/me', '/bills', '/notifications']) {
    assert.equal(
      requests
        .find(({ url }) => url.endsWith(path))
        .headers.get('authorization'),
      'Bearer application-jwt',
    );
  }
  assert.equal(
    requests
      .find(({ url }) => url.endsWith('/auth/login'))
      .headers.get('authorization'),
    null,
  );
});
