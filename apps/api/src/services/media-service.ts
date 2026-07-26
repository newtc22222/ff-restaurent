import { EntryStatus } from '@prisma/client';
import type { MultipartFile } from '@fastify/multipart';
import { badRequest, conflict } from '../http/app-error.js';
import { prisma } from '../lib/prisma.js';
import { isHeadChef } from '../lib/roles.js';
import type { CurrentUser } from '../lib/roles.js';
import {
  managedPublicPath,
  PUBLIC_IMAGE_LIMIT,
  publicImageUrl,
  QR_IMAGE_LIMIT,
  removeObject,
  signedQrUrl,
  storageBuckets,
  uploadImage,
} from './storage.js';

/**
 * Media persistence: avatars, restaurant imagery, and payment QR images.
 *
 * Two rules shape this module:
 *
 * - Storage and the database must not drift. Every write uploads first, then
 *   persists, and removes the freshly uploaded object if persistence fails.
 * - Supersede-then-delete is best effort: losing the *old* object is a leak,
 *   not a correctness failure, so those removals are logged and swallowed.
 *
 * Functions return `null` where the route already answered 404 with a bare
 * `{ message }` body, so response shapes are unchanged.
 */

/** Just enough of the Fastify logger for cleanup warnings. */
type Logger = { warn: (obj: unknown, message: string) => void };

/** Maximum concurrently active payment QR images per owner. */
const ACTIVE_QR_LIMIT = 5;

const MAX_LABEL = 80;

export const parseQrLabel = (value: unknown, { allowEmpty = false } = {}) => {
  const label = String(value ?? '').trim();
  if (!label && allowEmpty) return '';
  if (!label || label.length > MAX_LABEL) {
    throw badRequest(
      'VALIDATION_ERROR',
      `QR label must be 1 to ${MAX_LABEL} characters`,
    );
  }
  return label;
};

const serializeQr = async (qr: {
  id: string;
  label: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  status: EntryStatus;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: qr.id,
  label: qr.label,
  mimeType: qr.mimeType,
  sizeBytes: qr.sizeBytes,
  status: qr.status,
  imageUrl: await signedQrUrl(qr.storagePath),
  createdAt: qr.createdAt,
  updatedAt: qr.updatedAt,
});

/**
 * Removes an image we previously uploaded, ignoring anything we do not own.
 * Failure is logged rather than raised — the new image is already live.
 */
const removeSuperseded = async (
  logger: Logger,
  url: string | null | undefined,
) => {
  const path = managedPublicPath(url);
  if (!path) return;
  try {
    await removeObject(storageBuckets().publicBucket, path);
  } catch (error) {
    logger.warn({ err: error, path }, 'Could not remove superseded image');
  }
};

/** Persists a just-uploaded object, deleting it again if the write fails. */
const persistOrRollback = async <T>(
  bucket: string,
  path: string,
  persist: () => Promise<T>,
) => {
  try {
    return await persist();
  } catch (error) {
    await removeObject(bucket, path).catch(() => undefined);
    throw error;
  }
};

export const replaceUserAvatar = async (
  userId: string,
  part: MultipartFile,
  logger: Logger,
) => {
  const previous = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { avatarUrl: true },
  });
  const uploaded = await uploadImage({
    part,
    bucket: storageBuckets().publicBucket,
    folder: `users/${userId}/avatar`,
    limit: PUBLIC_IMAGE_LIMIT,
  });
  const avatarUrl = publicImageUrl(uploaded.path);
  await persistOrRollback(storageBuckets().publicBucket, uploaded.path, () =>
    prisma.user.update({ where: { id: userId }, data: { avatarUrl } }),
  );
  await removeSuperseded(logger, previous.avatarUrl);
  return { avatarUrl };
};

export const clearUserAvatar = async (userId: string, logger: Logger) => {
  const previous = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { avatarUrl: true },
  });
  await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl: null },
  });
  await removeSuperseded(logger, previous.avatarUrl);
};

export type RestaurantImageKind = 'logo' | 'banner';

const imageField = (kind: RestaurantImageKind) =>
  kind === 'logo' ? ('avatarUrl' as const) : ('bannerImageUrl' as const);

/**
 * Returns null when the restaurant does not exist.
 *
 * The body is read through `readPart` *after* existence is confirmed, so a
 * request naming an unknown restaurant is rejected with 404 without waiting on
 * the upload — and an empty body against an unknown id still gets 404 rather
 * than a multipart error.
 */
export const replaceRestaurantImage = async (
  restaurantId: string,
  kind: RestaurantImageKind,
  readPart: () => Promise<MultipartFile>,
  logger: Logger,
) => {
  const field = imageField(kind);
  const restaurant = await prisma.restaurantEntry.findUnique({
    where: { id: restaurantId },
    select: { avatarUrl: true, bannerImageUrl: true },
  });
  if (!restaurant) return null;
  const part = await readPart();
  const uploaded = await uploadImage({
    part,
    bucket: storageBuckets().publicBucket,
    folder: `restaurants/${restaurantId}/${kind}`,
    limit: PUBLIC_IMAGE_LIMIT,
  });
  const imageUrl = publicImageUrl(uploaded.path);
  await persistOrRollback(storageBuckets().publicBucket, uploaded.path, () =>
    prisma.restaurantEntry.update({
      where: { id: restaurantId },
      data: { [field]: imageUrl },
    }),
  );
  await removeSuperseded(logger, restaurant[field]);
  return { imageUrl };
};

/** Returns null when the restaurant does not exist. */
export const clearRestaurantImage = async (
  restaurantId: string,
  kind: RestaurantImageKind,
  logger: Logger,
) => {
  const field = imageField(kind);
  const restaurant = await prisma.restaurantEntry.findUnique({
    where: { id: restaurantId },
    select: { avatarUrl: true, bannerImageUrl: true },
  });
  if (!restaurant) return null;
  await prisma.restaurantEntry.update({
    where: { id: restaurantId },
    data: { [field]: null },
  });
  await removeSuperseded(logger, restaurant[field]);
  return { cleared: true as const };
};

export const listOwnQrImages = async (ownerId: string) => {
  const rows = await prisma.paymentQrImage.findMany({
    where: { ownerId, status: EntryStatus.ACTIVE },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  return Promise.all(rows.map(serializeQr));
};

/**
 * The advisory lock makes the active-count check and the insert atomic, so
 * concurrent uploads cannot both observe four active images and each add one.
 */
export const createQrImage = async (
  ownerId: string,
  part: MultipartFile,
  label: string,
) => {
  const uploaded = await uploadImage({
    part,
    bucket: storageBuckets().qrBucket,
    folder: `users/${ownerId}/payment-qr`,
    limit: QR_IMAGE_LIMIT,
  });
  const qr = await persistOrRollback(
    storageBuckets().qrBucket,
    uploaded.path,
    () =>
      prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${ownerId}))::text AS lock`;
        const active = await tx.paymentQrImage.count({
          where: { ownerId, status: EntryStatus.ACTIVE },
        });
        if (active >= ACTIVE_QR_LIMIT) {
          // Message text is part of the shipped contract; keep it verbatim.
          throw conflict(
            'QR_LIMIT_REACHED',
            'At most five active payment QR images are allowed',
          );
        }
        return tx.paymentQrImage.create({
          data: {
            ownerId,
            label,
            storagePath: uploaded.path,
            mimeType: uploaded.mimeType,
            sizeBytes: uploaded.sizeBytes,
          },
        });
      }),
  );
  return serializeQr(qr);
};

/** Returns null when the caller owns no active QR image with that id. */
export const renameQrImage = async (
  ownerId: string,
  id: string,
  label: string,
) => {
  const result = await prisma.paymentQrImage.updateMany({
    where: { id, ownerId, status: EntryStatus.ACTIVE },
    data: { label },
  });
  if (result.count !== 1) return null;
  const qr = await prisma.paymentQrImage.findUniqueOrThrow({ where: { id } });
  return serializeQr(qr);
};

/**
 * Replacement archives the old row rather than deleting it, because bills may
 * still reference it. Returns null when the image is not the caller's.
 */
export const replaceQrImage = async (
  ownerId: string,
  id: string,
  readPart: () => Promise<{ part: MultipartFile; label: string }>,
) => {
  const current = await prisma.paymentQrImage.findFirst({
    where: { id, ownerId, status: EntryStatus.ACTIVE },
  });
  if (!current) return null;
  const { part, label: submitted } = await readPart();
  const label = submitted || current.label;
  if (label.length > MAX_LABEL) {
    throw badRequest(
      'VALIDATION_ERROR',
      `QR label must be at most ${MAX_LABEL} characters`,
    );
  }
  const uploaded = await uploadImage({
    part,
    bucket: storageBuckets().qrBucket,
    folder: `users/${ownerId}/payment-qr`,
    limit: QR_IMAGE_LIMIT,
  });
  const replacement = await persistOrRollback(
    storageBuckets().qrBucket,
    uploaded.path,
    () =>
      prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${ownerId}))::text AS lock`;
        await tx.paymentQrImage.update({
          where: { id },
          data: { status: EntryStatus.ARCHIVED },
        });
        return tx.paymentQrImage.create({
          data: {
            ownerId,
            label,
            storagePath: uploaded.path,
            mimeType: uploaded.mimeType,
            sizeBytes: uploaded.sizeBytes,
          },
        });
      }),
  );
  return serializeQr(replacement);
};

/**
 * A QR image referenced by any bill is archived rather than deleted, so those
 * bills keep resolving. Returns null when it is not the caller's.
 */
export const deleteQrImage = async (ownerId: string, id: string) => {
  const qr = await prisma.paymentQrImage.findFirst({
    where: { id, ownerId, status: EntryStatus.ACTIVE },
    include: { _count: { select: { bills: true } } },
  });
  if (!qr) return null;
  if (qr._count.bills > 0) {
    await prisma.paymentQrImage.update({
      where: { id },
      data: { status: EntryStatus.ARCHIVED },
    });
  } else {
    await removeObject(storageBuckets().qrBucket, qr.storagePath);
    await prisma.paymentQrImage.delete({ where: { id } });
  }
  return { deleted: true as const };
};

export type BillQrOptions =
  | { outcome: 'not-found' }
  | { outcome: 'forbidden' }
  | { outcome: 'ok'; images: Awaited<ReturnType<typeof serializeQr>>[] };

/** Only the bill owner (or a HEAD_CHEF) may see the owner's QR images. */
export const listBillQrOptions = async (
  billId: string,
  currentUser: CurrentUser,
): Promise<BillQrOptions> => {
  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    select: { createdById: true },
  });
  if (!bill) return { outcome: 'not-found' };
  if (bill.createdById !== currentUser.id && !isHeadChef(currentUser)) {
    return { outcome: 'forbidden' };
  }
  return { outcome: 'ok', images: await listOwnQrImages(bill.createdById) };
};
