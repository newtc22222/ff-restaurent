import { Storage } from '@google-cloud/storage';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { prisma } from '../../src/lib/prisma.js';
import {
  gcsPublicUrl,
  managedPublicPathFor,
} from '../../src/services/storage.js';

type Mode = 'plan' | 'apply' | 'verify';
type PublicReference =
  | { model: 'user'; id: string; field: 'avatarUrl'; url: string; path: string }
  | {
      model: 'restaurant';
      id: string;
      field: 'avatarUrl' | 'bannerImageUrl';
      url: string;
      path: string;
    };

const requiredEnv = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const objectUrl = (baseUrl: string, bucket: string, path: string) =>
  `${baseUrl.replace(/\/$/, '')}/storage/v1/object/authenticated/${encodeURIComponent(
    bucket,
  )}/${path.split('/').map(encodeURIComponent).join('/')}`;

const modeFromArgs = (): Mode => {
  const selected = process.argv.slice(2);
  if (selected.length === 0 || selected[0] === '--plan') return 'plan';
  if (selected.length === 1 && selected[0] === '--apply') return 'apply';
  if (selected.length === 1 && selected[0] === '--verify') return 'verify';
  throw new Error('Use exactly one of --plan, --apply, or --verify');
};

const md5 = (buffer: Buffer) =>
  createHash('md5').update(buffer).digest('base64');

const main = async () => {
  const mode = modeFromArgs();
  const publicBucket = requiredEnv('GCS_PUBLIC_BUCKET');
  const qrBucket = requiredEnv('GCS_QR_BUCKET');
  const legacyPublicBucket =
    process.env.SUPABASE_PUBLIC_BUCKET?.trim() || 'ff-public-images';
  const legacyQrBucket =
    process.env.SUPABASE_QR_BUCKET?.trim() || 'ff-payment-qr';
  const projectId = process.env.GCP_PROJECT_ID?.trim();
  const storage = new Storage(projectId ? { projectId } : undefined);

  const [users, restaurants, qrImages] = await Promise.all([
    prisma.user.findMany({
      where: { avatarUrl: { not: null } },
      select: { id: true, avatarUrl: true },
    }),
    prisma.restaurantEntry.findMany({
      where: {
        OR: [{ avatarUrl: { not: null } }, { bannerImageUrl: { not: null } }],
      },
      select: { id: true, avatarUrl: true, bannerImageUrl: true },
    }),
    prisma.paymentQrImage.findMany({
      select: { storagePath: true, mimeType: true, sizeBytes: true },
    }),
  ]);

  const publicReferences: PublicReference[] = [];
  const addPublicReference = (
    reference:
      | Omit<Extract<PublicReference, { model: 'user' }>, 'path'>
      | Omit<Extract<PublicReference, { model: 'restaurant' }>, 'path'>,
  ) => {
    const path = managedPublicPathFor(reference.url, {
      publicBucket,
      legacySupabasePublicBucket: legacyPublicBucket,
    });
    if (path) publicReferences.push({ ...reference, path } as PublicReference);
  };

  for (const user of users) {
    if (user.avatarUrl) {
      addPublicReference({
        model: 'user',
        id: user.id,
        field: 'avatarUrl',
        url: user.avatarUrl,
      });
    }
  }
  for (const restaurant of restaurants) {
    if (restaurant.avatarUrl) {
      addPublicReference({
        model: 'restaurant',
        id: restaurant.id,
        field: 'avatarUrl',
        url: restaurant.avatarUrl,
      });
    }
    if (restaurant.bannerImageUrl) {
      addPublicReference({
        model: 'restaurant',
        id: restaurant.id,
        field: 'bannerImageUrl',
        url: restaurant.bannerImageUrl,
      });
    }
  }

  const publicPaths = [...new Set(publicReferences.map(({ path }) => path))];
  const qrByPath = new Map(
    qrImages.map((image) => [image.storagePath, image] as const),
  );
  const legacyUrlCount = publicReferences.filter(
    ({ url }) => new URL(url).hostname !== 'storage.googleapis.com',
  ).length;

  const summary = {
    mode,
    managedPublicReferences: publicReferences.length,
    uniquePublicObjects: publicPaths.length,
    qrObjects: qrByPath.size,
    legacyDatabaseUrls: legacyUrlCount,
  };
  if (mode === 'plan') {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const verifyDestination = async (
    bucket: string,
    path: string,
    expectedSize?: number,
  ) => {
    const [exists] = await storage.bucket(bucket).file(path).exists();
    if (!exists) throw new Error(`Missing destination object in ${bucket}`);
    if (expectedSize !== undefined) {
      const [metadata] = await storage.bucket(bucket).file(path).getMetadata();
      if (Number(metadata.size) !== expectedSize) {
        throw new Error(`Destination object size mismatch in ${bucket}`);
      }
    }
  };

  if (mode === 'verify') {
    await Promise.all([
      ...publicPaths.map((path) => verifyDestination(publicBucket, path)),
      ...[...qrByPath.values()].map((image) =>
        verifyDestination(qrBucket, image.storagePath, image.sizeBytes),
      ),
    ]);
    if (legacyUrlCount > 0) {
      throw new Error(
        `${legacyUrlCount} managed public image URLs still reference Supabase`,
      );
    }
    console.log(JSON.stringify({ ...summary, verified: true }, null, 2));
    return;
  }

  const supabaseUrl = requiredEnv('SUPABASE_URL');
  const supabaseServiceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  const fetchSource = async (bucket: string, path: string) => {
    const response = await fetch(objectUrl(supabaseUrl, bucket, path), {
      headers: {
        apikey: supabaseServiceRoleKey,
        authorization: `Bearer ${supabaseServiceRoleKey}`,
      },
    });
    if (!response.ok) {
      throw new Error(
        `Could not read a Supabase object from ${bucket}: HTTP ${response.status}`,
      );
    }
    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      contentType:
        response.headers.get('content-type') || 'application/octet-stream',
    };
  };

  const copyObject = async ({
    sourceBucket,
    destinationBucket,
    path,
    cacheControl,
    expectedSize,
  }: {
    sourceBucket: string;
    destinationBucket: string;
    path: string;
    cacheControl: string;
    expectedSize?: number;
  }) => {
    const source = await fetchSource(sourceBucket, path);
    if (expectedSize !== undefined && source.buffer.length !== expectedSize) {
      throw new Error(`Source object size mismatch in ${sourceBucket}`);
    }
    const file = storage.bucket(destinationBucket).file(path);
    const [exists] = await file.exists();
    if (exists) {
      const [metadata] = await file.getMetadata();
      if (metadata.md5Hash !== md5(source.buffer)) {
        throw new Error(
          `Destination object content mismatch in ${destinationBucket}`,
        );
      }
      return 'verified';
    }
    await file.save(source.buffer, {
      resumable: false,
      metadata: {
        contentType: source.contentType,
        cacheControl,
      },
      preconditionOpts: { ifGenerationMatch: 0 },
    });
    const [metadata] = await file.getMetadata();
    if (metadata.md5Hash !== md5(source.buffer)) {
      throw new Error(
        `Copied object verification failed in ${destinationBucket}`,
      );
    }
    return 'copied';
  };

  const copyResults = await Promise.all([
    ...publicPaths.map((path) =>
      copyObject({
        sourceBucket: legacyPublicBucket,
        destinationBucket: publicBucket,
        path,
        cacheControl: 'public, max-age=31536000, immutable',
      }),
    ),
    ...[...qrByPath.values()].map((image) =>
      copyObject({
        sourceBucket: legacyQrBucket,
        destinationBucket: qrBucket,
        path: image.storagePath,
        cacheControl: 'private, no-store, max-age=0',
        expectedSize: image.sizeBytes,
      }),
    ),
  ]);

  await prisma.$transaction(
    publicReferences
      .filter(({ url }) => new URL(url).hostname !== 'storage.googleapis.com')
      .map((reference) => {
        const url = gcsPublicUrl(publicBucket, reference.path);
        return reference.model === 'user'
          ? prisma.user.update({
              where: { id: reference.id },
              data: { avatarUrl: url },
            })
          : prisma.restaurantEntry.update({
              where: { id: reference.id },
              data: { [reference.field]: url },
            });
      }),
  );

  const copied = copyResults.filter((result) => result === 'copied').length;
  console.log(
    JSON.stringify(
      {
        ...summary,
        copied,
        verifiedExisting: copyResults.length - copied,
        rewrittenDatabaseUrls: legacyUrlCount,
      },
      null,
      2,
    ),
  );
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main()
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
