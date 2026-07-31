import assert from 'node:assert/strict';
import test from 'node:test';

import { applyCatalogCache, computeEtag } from './http-cache.js';

type HeaderCall = [string, string];

const fakeReply = () => {
  const headers: HeaderCall[] = [];
  let statusCode = 200;
  return {
    header(name: string, value: string) {
      headers.push([name, value]);
      return this;
    },
    code(status: number) {
      statusCode = status;
      return this;
    },
    get statusCode() {
      return statusCode;
    },
    headers,
  };
};

const fakeRequest = (ifNoneMatch?: string) => ({
  headers: ifNoneMatch ? { 'if-none-match': ifNoneMatch } : {},
});

test('computeEtag is stable for identical payloads and differs when the payload changes', () => {
  const payload = { items: [{ id: '1', name: 'Vietnamese' }] };
  const other = { items: [{ id: '1', name: 'Thai' }] };
  assert.equal(computeEtag(payload), computeEtag(payload));
  assert.notEqual(computeEtag(payload), computeEtag(other));
});

test('applyCatalogCache sets a private, always-revalidated validator and returns false on a fresh request', () => {
  const reply = fakeReply();
  const request = fakeRequest();
  const payload = {
    items: [],
    pageInfo: { endCursor: null, hasNextPage: false },
  };

  const short = applyCatalogCache(request as never, reply as never, payload);

  assert.equal(short, false);
  assert.equal(reply.statusCode, 200);
  const cacheControl = reply.headers.find(([name]) => name === 'Cache-Control');
  assert.equal(cacheControl?.[1], 'private, no-cache');
  const etagHeader = reply.headers.find(([name]) => name === 'ETag');
  assert.equal(etagHeader?.[1], computeEtag(payload));
});

test('applyCatalogCache returns true and sends 304 when If-None-Match matches the current ETag', () => {
  const payload = { items: [{ id: 'a' }], pageInfo: {} };
  const etag = computeEtag(payload);
  const reply = fakeReply();
  const request = fakeRequest(etag);

  const notModified = applyCatalogCache(
    request as never,
    reply as never,
    payload,
  );

  assert.equal(notModified, true);
  assert.equal(reply.statusCode, 304);
});

test('applyCatalogCache does not short-circuit when If-None-Match is stale', () => {
  const reply = fakeReply();
  const request = fakeRequest('"stale-etag-value"');
  const payload = { items: [{ id: 'b' }], pageInfo: {} };

  const notModified = applyCatalogCache(
    request as never,
    reply as never,
    payload,
  );

  assert.equal(notModified, false);
  assert.equal(reply.statusCode, 200);
});

test('applyCatalogCache returns a fresh ETag reflecting a changed payload (mutation immediately visible)', () => {
  const before = { items: [{ id: 'c', name: 'Old name' }], pageInfo: {} };
  const after = { items: [{ id: 'c', name: 'New name' }], pageInfo: {} };
  const beforeReply = fakeReply();
  applyCatalogCache(fakeRequest() as never, beforeReply as never, before);
  const previousEtag = beforeReply.headers.find(
    ([name]) => name === 'ETag',
  )?.[1];

  const afterReply = fakeReply();
  const notModified = applyCatalogCache(
    fakeRequest(previousEtag) as never,
    afterReply as never,
    after,
  );

  assert.equal(notModified, false);
  assert.equal(afterReply.statusCode, 200);
});
