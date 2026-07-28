import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertDestinationObjectMatchesSource,
  md5Base64,
} from './storage-object-integrity.js';

test('storage migration integrity accepts matching source content', () => {
  const source = Buffer.from('same content');

  assert.doesNotThrow(() =>
    assertDestinationObjectMatchesSource({
      source,
      metadata: { size: String(source.length), md5Hash: md5Base64(source) },
      sourceBucket: 'legacy',
      destinationBucket: 'gcs',
      expectedSize: source.length,
    }),
  );
});

test('storage migration integrity rejects same-sized corrupted content', () => {
  const source = Buffer.from('source');
  const corrupted = Buffer.from('broken');

  assert.equal(source.length, corrupted.length);
  assert.throws(
    () =>
      assertDestinationObjectMatchesSource({
        source,
        metadata: {
          size: String(corrupted.length),
          md5Hash: md5Base64(corrupted),
        },
        sourceBucket: 'legacy',
        destinationBucket: 'gcs',
        expectedSize: source.length,
      }),
    /Destination object content mismatch in gcs/,
  );
});
