import type { MultipartFile } from '@fastify/multipart';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { fileTypeFromBuffer } from 'file-type';
import { randomUUID } from 'node:crypto';
import { loadConfig } from './config.js';

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

let client: SupabaseClient | null = null;

const storage = () => {
  const config = loadConfig();
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw storageError(
      'Supabase Storage is not configured',
      503,
      'STORAGE_NOT_CONFIGURED',
    );
  }
  client ??= createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { client, config };
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
  const { client: supabase } = storage();
  const { error } = await supabase.storage.from(bucket).upload(path, image.buffer, {
    contentType: image.mimeType,
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw storageError(`Image upload failed: ${error.message}`);
  return {
    path,
    mimeType: image.mimeType,
    sizeBytes: image.buffer.length,
  };
};

export const publicImageUrl = (path: string) => {
  const { client: supabase, config } = storage();
  return supabase.storage.from(config.supabasePublicBucket).getPublicUrl(path)
    .data.publicUrl;
};

export const signedQrUrl = async (path: string) => {
  const { client: supabase, config } = storage();
  const { data, error } = await supabase.storage
    .from(config.supabaseQrBucket)
    .createSignedUrl(path, config.supabaseSignedUrlTtlSeconds);
  if (error) throw storageError(`Could not sign image URL: ${error.message}`);
  return data.signedUrl;
};

export const removeObject = async (bucket: string, path: string) => {
  const { client: supabase } = storage();
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw storageError(`Could not remove image: ${error.message}`);
};

export const managedPublicPath = (url: string | null | undefined) => {
  if (!url) return null;
  const { config } = storage();
  try {
    const parsed = new URL(url);
    const marker = `/storage/v1/object/public/${config.supabasePublicBucket}/`;
    const index = parsed.pathname.indexOf(marker);
    return index < 0
      ? null
      : decodeURIComponent(parsed.pathname.slice(index + marker.length));
  } catch {
    return null;
  }
};

export const storageBuckets = () => {
  const { config } = storage();
  return {
    publicBucket: config.supabasePublicBucket,
    qrBucket: config.supabaseQrBucket,
  };
};
