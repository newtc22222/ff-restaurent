import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AddressDirectory,
  AddressDirectoryUnavailableError,
} from './address-directory.js';

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

test('normalizes provinces and wards without requesting depth=3', async () => {
  const urls: string[] = [];
  const directory = new AddressDirectory({
    baseUrl: 'https://example.test/api/v2/',
    timeoutMs: 100,
    cacheTtlMs: 1_000,
    fetcher: async (input) => {
      const url = String(input);
      urls.push(url);
      return url.includes('/p/79')
        ? jsonResponse({ wards: [{ code: 26734, name: 'Phường Bến Nghé' }] })
        : jsonResponse([{ code: 79, name: 'Thành phố Hồ Chí Minh' }]);
    },
  });

  assert.deepEqual(await directory.getProvinces(), {
    items: [{ code: '79', name: 'Thành phố Hồ Chí Minh' }],
    stale: false,
  });
  assert.deepEqual(await directory.getWards('79'), {
    items: [{ code: '26734', name: 'Phường Bến Nghé' }],
    stale: false,
  });
  assert.deepEqual(urls, [
    'https://example.test/api/v2/',
    'https://example.test/api/v2/p/79?depth=2',
  ]);
  assert.equal(
    urls.some((url) => url.includes('depth=3')),
    false,
  );
});

test('uses fresh cache and serves stale cache after an upstream failure', async () => {
  let now = 1_000;
  let calls = 0;
  const directory = new AddressDirectory({
    baseUrl: 'https://example.test/',
    timeoutMs: 100,
    cacheTtlMs: 50,
    now: () => now,
    fetcher: async () => {
      calls += 1;
      if (calls > 1) throw new Error('offline');
      return jsonResponse([{ code: 1, name: 'Hà Nội' }]);
    },
  });

  const first = await directory.getProvinces();
  now += 20;
  const cached = await directory.getProvinces();
  now += 50;
  const stale = await directory.getProvinces();

  assert.deepEqual(first, cached);
  assert.equal(calls, 2);
  assert.deepEqual(stale, { ...first, stale: true });
});

test('returns a stable unavailable error when timeout occurs without cache', async () => {
  const directory = new AddressDirectory({
    baseUrl: 'https://example.test/',
    timeoutMs: 5,
    cacheTtlMs: 50,
    fetcher: async (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        const guard = setTimeout(
          () => reject(new Error('Abort signal did not fire')),
          100,
        );
        init?.signal?.addEventListener('abort', () => {
          clearTimeout(guard);
          reject(init.signal?.reason);
        });
      }),
  });

  await assert.rejects(
    directory.getProvinces(),
    (error: unknown) =>
      error instanceof AddressDirectoryUnavailableError &&
      error.code === 'ADDRESS_DIRECTORY_UNAVAILABLE' &&
      error.statusCode === 503,
  );
});
