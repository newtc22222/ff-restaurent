import { randomUUID } from 'node:crypto';

import type { MultipartFile } from '@fastify/multipart';
import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import { fileTypeFromBuffer } from 'file-type';

import { loadConfig } from '../config/config.js';

export const PUBLIC_IMAGE_LIMIT = 5 * 1024 * 1024;
export const QR_IMAGE_LIMIT = 2 * 1024 * 1024;
const allowedTypes = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

const storageError = (
  message: string,
  statusCode = 502,
  code = 'STORAGE_ERROR',
) => Object.assign(new Error(message), { statusCode, code });

let client: Storage | null = null;

const storage = () => {
  const config = loadConfig();
  if (!config.gcsPublicBucket || !config.gcsQrBucket) {
    throw storageError(
      'Google Cloud Storage is not configured',
      503,
      'STORAGE_NOT_CONFIGURED',
    );
  }
  client ??= new Storage(
    config.gcpProjectId ? { projectId: config.gcpProjectId } : undefined,
  );
  return {
    client,
    publicBucket: config.gcsPublicBucket,
    qrBucket: config.gcsQrBucket,
    signedUrlTtlSeconds: config.gcsSignedUrlTtlSeconds,
    legacySupabasePublicBucket: config.legacySupabasePublicBucket,
  };
};

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export const gcsPublicUrl = (bucket: string, path: string) =>
  `https://storage.googleapis.com/${bucket}/${path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;

export const managedPublicPathFor = (
  url: string | null | undefined,
  {
    publicBucket,
    legacySupabasePublicBucket,
  }: { publicBucket: string; legacySupabasePublicBucket: string },
) => {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const gcsMarker = `/${publicBucket}/`;
    if (
      parsed.hostname === 'storage.googleapis.com' &&
      parsed.pathname.startsWith(gcsMarker)
    ) {
      return decodeURIComponent(parsed.pathname.slice(gcsMarker.length));
    }
    if (
      parsed.hostname === `${publicBucket}.storage.googleapis.com` &&
      parsed.pathname.length > 1
    ) {
      return decodeURIComponent(parsed.pathname.slice(1));
    }
    const supabaseMarker = `/storage/v1/object/public/${legacySupabasePublicBucket}/`;
    const index = parsed.pathname.indexOf(supabaseMarker);
    return index < 0
      ? null
      : decodeURIComponent(
          parsed.pathname.slice(index + supabaseMarker.length),
        );
  } catch {
    return null;
  }
};

export const validateImage = async (part: MultipartFile, limit: number) => {
  let buffer: Buffer;
  try {
    buffer = await part.toBuffer();
  } catch {
    throw storageError('Image exceeds the size limit', 413, 'IMAGE_TOO_LARGE');
  }
  if (buffer.length === 0) {
    throw storageError('Image file is empty', 400, 'IMAGE_EMPTY');
  }
  if (buffer.length > limit || part.file.truncated) {
    throw storageError('Image exceeds the size limit', 413, 'IMAGE_TOO_LARGE');
  }
  const detected = await fileTypeFromBuffer(buffer);
  const extension = detected ? allowedTypes.get(detected.mime) : undefined;
  if (!detected || !extension || detected.mime !== part.mimetype) {
    throw storageError(
      'Only genuine JPEG, PNG, and WebP images are allowed',
      400,
      'IMAGE_TYPE_INVALID',
    );
  }
  return { buffer, mimeType: detected.mime, extension };
};

export const uploadImage = async ({
  part,
  bucket,
  folder,
  limit,
}: {
  part: MultipartFile;
  bucket: string;
  folder: string;
  limit: number;
}) => {
  const image = await validateImage(part, limit);
  const path = `${folder}/${randomUUID()}.${image.extension}`;
  const store = storage();
  const cacheControl =
    bucket === store.publicBucket
      ? 'public, max-age=31536000, immutable'
      : 'private, no-store, max-age=0';
  try {
    await store.client
      .bucket(bucket)
      .file(path)
      .save(image.buffer, {
        resumable: false,
        metadata: {
          contentType: image.mimeType,
          cacheControl,
        },
        preconditionOpts: { ifGenerationMatch: 0 },
      });
  } catch (error) {
    throw storageError(`Image upload failed: ${errorMessage(error)}`);
  }
  return {
    path,
    mimeType: image.mimeType,
    sizeBytes: image.buffer.length,
  };
};

export const publicImageUrl = (path: string) => {
  const { publicBucket } = storage();
  return gcsPublicUrl(publicBucket, path);
};

export const signedQrUrl = async (path: string) => {
  const store = storage();
  try {
    const [url] = await store.client
      .bucket(store.qrBucket)
      .file(path)
      .getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + store.signedUrlTtlSeconds * 1000,
      });
    return url;
  } catch (error) {
    throw storageError(`Could not sign image URL: ${errorMessage(error)}`);
  }
};

export const removeObject = async (bucket: string, path: string) => {
  const { client: cloudStorage } = storage();
  try {
    await cloudStorage
      .bucket(bucket)
      .file(path)
      .delete({ ignoreNotFound: true });
  } catch (error) {
    throw storageError(`Could not remove image: ${errorMessage(error)}`);
  }
};

export const managedPublicPath = (url: string | null | undefined) => {
  const { publicBucket, legacySupabasePublicBucket } = storage();
  return managedPublicPathFor(url, {
    publicBucket,
    legacySupabasePublicBucket,
  });
};

export const storageBuckets = () => {
  const { publicBucket, qrBucket } = storage();
  return {
    publicBucket,
    qrBucket,
  };
};
