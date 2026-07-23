import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveServerAddress } from './server-config.js';

test('Cloud Run PORT takes precedence over the legacy API_PORT', () => {
  assert.deepEqual(
    resolveServerAddress({
      PORT: '8080',
      API_PORT: '4000',
      API_HOST: '127.0.0.1',
    }),
    { port: 8080, host: '127.0.0.1' },
  );
});

test('server address keeps the existing local defaults and API_PORT fallback', () => {
  assert.deepEqual(resolveServerAddress({}), {
    port: 4000,
    host: '0.0.0.0',
  });
  assert.deepEqual(resolveServerAddress({ API_PORT: '4100' }), {
    port: 4100,
    host: '0.0.0.0',
  });
});

test('server address rejects invalid injected ports before listening', () => {
  for (const PORT of ['not-a-port', '0', '65536', '4000.5']) {
    assert.throws(
      () => resolveServerAddress({ PORT }),
      /integer between 1 and 65535/,
    );
  }
});
