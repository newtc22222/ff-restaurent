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
