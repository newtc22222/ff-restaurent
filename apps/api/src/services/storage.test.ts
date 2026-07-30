import assert from 'node:assert/strict';
import test from 'node:test';

import type { MultipartFile } from '@fastify/multipart';

import { validateImage } from './storage.js';

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nCEAAAAASUVORK5CYII=',
  'base64',
);
const part = (buffer: Buffer, mimetype = 'image/png') =>
  ({
    mimetype,
    file: { truncated: false },
    toBuffer: async () => buffer,
  }) as unknown as MultipartFile;

test('image validation accepts genuine safe web images', async () => {
  const result = await validateImage(part(png), 1024);
  assert.equal(result.mimeType, 'image/png');
  assert.equal(result.extension, 'png');
});

test('image validation rejects MIME spoofing and oversized images', async () => {
  await assert.rejects(
    validateImage(part(png, 'image/jpeg'), 1024),
    (error: Error & { code?: string }) => error.code === 'IMAGE_TYPE_INVALID',
  );
  await assert.rejects(
    validateImage(part(png), 1),
    (error: Error & { code?: string }) => error.code === 'IMAGE_TOO_LARGE',
  );
});

test('GCS public URLs encode each object path segment', () => {
  assert.equal(
    gcsPublicUrl('ff-public', 'restaurants/a logo/logo #1.png'),
    'https://storage.googleapis.com/ff-public/restaurants/a%20logo/logo%20%231.png',
  );
});

test('managed public paths recognize GCS and migrated Supabase URLs only', () => {
  const options = {
    publicBucket: 'ff-public',
    legacySupabasePublicBucket: 'ff-public-images',
  };
  assert.equal(
    managedPublicPathFor(
      'https://storage.googleapis.com/ff-public/users/a/avatar/x.png',
      options,
    ),
    'users/a/avatar/x.png',
  );
  assert.equal(
    managedPublicPathFor(
      'https://ff-public.storage.googleapis.com/restaurants/a/logo/x.png',
      options,
    ),
    'restaurants/a/logo/x.png',
  );
  assert.equal(
    managedPublicPathFor(
      'https://example.supabase.co/storage/v1/object/public/ff-public-images/users/a/avatar/x.png',
      options,
    ),
    'users/a/avatar/x.png',
  );
  assert.equal(
    managedPublicPathFor(
      'https://cdn.example.com/users/a/avatar/x.png',
      options,
    ),
    null,
  );
});
