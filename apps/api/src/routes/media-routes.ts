import type { FastifyInstance, FastifyRequest } from 'fastify';
import { EntryStatus } from '@prisma/client';
import {
  requireAuthenticatedUser,
  requireSousChefOrHeadChef,
} from '../http/auth-guards.js';
import { prisma } from '../prisma.js';
import { isHeadChef } from '../roles.js';
import {
  managedPublicPath,
  PUBLIC_IMAGE_LIMIT,
  publicImageUrl,
  QR_IMAGE_LIMIT,
  removeObject,
  signedQrUrl,
  storageBuckets,
  uploadImage,
} from '../storage.js';

const badRequest = (message: string, code = 'VALIDATION_ERROR') =>
  Object.assign(new Error(message), { statusCode: 400, code });

const multipartFile = async (request: FastifyRequest) => {
  const part = await request.file();
  if (!part) throw badRequest('An image file is required', 'IMAGE_REQUIRED');
  return part;
};

const fieldValue = (part: Awaited<ReturnType<typeof multipartFile>>, key: string) => {
  const field = part.fields[key];
  if (!field || Array.isArray(field) || field.type !== 'field') return '';
  return String(field.value ?? '').trim();
};

const removeManagedPublicImage = async (
  request: FastifyRequest,
  url: string | null | undefined,
) => {
  const path = managedPublicPath(url);
  if (!path) return;
  try {
    await removeObject(storageBuckets().publicBucket, path);
  } catch (error) {
    request.log.warn({ err: error, path }, 'Could not remove superseded image');
  }
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

/** Media routes keep the Supabase service role entirely behind app authorization. */
export const registerMediaRoutes = (app: FastifyInstance) => {
  app.put(
    '/me/avatar',
    { preHandler: requireAuthenticatedUser },
    async (request) => {
      const part = await multipartFile(request);
      const previous = await prisma.user.findUniqueOrThrow({
        where: { id: request.currentUser.id },
        select: { avatarUrl: true },
      });
      const uploaded = await uploadImage({
        part,
        bucket: storageBuckets().publicBucket,
        folder: `users/${request.currentUser.id}/avatar`,
        limit: PUBLIC_IMAGE_LIMIT,
      });
      const avatarUrl = publicImageUrl(uploaded.path);
      try {
        await prisma.user.update({
          where: { id: request.currentUser.id },
          data: { avatarUrl },
        });
      } catch (error) {
        await removeObject(storageBuckets().publicBucket, uploaded.path).catch(
          () => undefined,
        );
        throw error;
      }
      await removeManagedPublicImage(request, previous.avatarUrl);
      return { avatarUrl };
    },
  );

  app.delete(
    '/me/avatar',
    { preHandler: requireAuthenticatedUser },
    async (request, reply) => {
      const previous = await prisma.user.findUniqueOrThrow({
        where: { id: request.currentUser.id },
        select: { avatarUrl: true },
      });
      await prisma.user.update({
        where: { id: request.currentUser.id },
        data: { avatarUrl: null },
      });
      await removeManagedPublicImage(request, previous.avatarUrl);
      return reply.code(204).send();
    },
  );

  for (const kind of ['logo', 'banner'] as const) {
    const field = kind === 'logo' ? 'avatarUrl' : 'bannerImageUrl';
    app.put(
      `/restaurants/:id/${kind}`,
      {
        preHandler: [requireAuthenticatedUser, requireSousChefOrHeadChef],
      },
      async (request, reply) => {
        const { id } = request.params as { id: string };
        const restaurant = await prisma.restaurantEntry.findUnique({
          where: { id },
          select: { avatarUrl: true, bannerImageUrl: true },
        });
        if (!restaurant) return reply.code(404).send({ message: 'Restaurant not found' });
        const part = await multipartFile(request);
        const uploaded = await uploadImage({
          part,
          bucket: storageBuckets().publicBucket,
          folder: `restaurants/${id}/${kind}`,
          limit: PUBLIC_IMAGE_LIMIT,
        });
        const imageUrl = publicImageUrl(uploaded.path);
        try {
          await prisma.restaurantEntry.update({
            where: { id },
            data: { [field]: imageUrl },
          });
        } catch (error) {
          await removeObject(storageBuckets().publicBucket, uploaded.path).catch(
            () => undefined,
          );
          throw error;
        }
        await removeManagedPublicImage(request, restaurant[field]);
        return { imageUrl };
      },
    );

    app.delete(
      `/restaurants/:id/${kind}`,
      {
        preHandler: [requireAuthenticatedUser, requireSousChefOrHeadChef],
      },
      async (request, reply) => {
        const { id } = request.params as { id: string };
        const restaurant = await prisma.restaurantEntry.findUnique({
          where: { id },
          select: { avatarUrl: true, bannerImageUrl: true },
        });
        if (!restaurant) return reply.code(404).send({ message: 'Restaurant not found' });
        await prisma.restaurantEntry.update({
          where: { id },
          data: { [field]: null },
        });
        await removeManagedPublicImage(request, restaurant[field]);
        return reply.code(204).send();
      },
    );
  }

  app.get(
    '/me/payment-qr-images',
    { preHandler: [requireAuthenticatedUser, requireSousChefOrHeadChef] },
    async (request) => {
      const rows = await prisma.paymentQrImage.findMany({
        where: { ownerId: request.currentUser.id, status: EntryStatus.ACTIVE },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      return Promise.all(rows.map(serializeQr));
    },
  );

  app.post(
    '/me/payment-qr-images',
    { preHandler: [requireAuthenticatedUser, requireSousChefOrHeadChef] },
    async (request, reply) => {
      const part = await multipartFile(request);
      const label = fieldValue(part, 'label');
      if (!label || label.length > 80) throw badRequest('QR label must be 1 to 80 characters');
      const uploaded = await uploadImage({
        part,
        bucket: storageBuckets().qrBucket,
        folder: `users/${request.currentUser.id}/payment-qr`,
        limit: QR_IMAGE_LIMIT,
      });
      try {
        const qr = await prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${request.currentUser.id}))::text AS lock`;
          const active = await tx.paymentQrImage.count({
            where: { ownerId: request.currentUser.id, status: EntryStatus.ACTIVE },
          });
          if (active >= 5) {
            throw Object.assign(new Error('At most five active payment QR images are allowed'), {
              statusCode: 409,
              code: 'QR_LIMIT_REACHED',
            });
          }
          return tx.paymentQrImage.create({
            data: {
              ownerId: request.currentUser.id,
              label,
              storagePath: uploaded.path,
              mimeType: uploaded.mimeType,
              sizeBytes: uploaded.sizeBytes,
            },
          });
        });
        return reply.code(201).send(await serializeQr(qr));
      } catch (error) {
        await removeObject(storageBuckets().qrBucket, uploaded.path).catch(() => undefined);
        throw error;
      }
    },
  );

  app.patch(
    '/me/payment-qr-images/:id',
    { preHandler: [requireAuthenticatedUser, requireSousChefOrHeadChef] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const label = String((request.body as { label?: unknown })?.label ?? '').trim();
      if (!label || label.length > 80) throw badRequest('QR label must be 1 to 80 characters');
      const result = await prisma.paymentQrImage.updateMany({
        where: { id, ownerId: request.currentUser.id, status: EntryStatus.ACTIVE },
        data: { label },
      });
      if (result.count !== 1) return reply.code(404).send({ message: 'Payment QR image not found' });
      const qr = await prisma.paymentQrImage.findUniqueOrThrow({ where: { id } });
      return serializeQr(qr);
    },
  );

  app.post(
    '/me/payment-qr-images/:id/replacement',
    { preHandler: [requireAuthenticatedUser, requireSousChefOrHeadChef] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const current = await prisma.paymentQrImage.findFirst({
        where: { id, ownerId: request.currentUser.id, status: EntryStatus.ACTIVE },
      });
      if (!current) return reply.code(404).send({ message: 'Payment QR image not found' });
      const part = await multipartFile(request);
      const label = fieldValue(part, 'label') || current.label;
      if (label.length > 80) throw badRequest('QR label must be at most 80 characters');
      const uploaded = await uploadImage({
        part,
        bucket: storageBuckets().qrBucket,
        folder: `users/${request.currentUser.id}/payment-qr`,
        limit: QR_IMAGE_LIMIT,
      });
      try {
        const replacement = await prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${request.currentUser.id}))::text AS lock`;
          await tx.paymentQrImage.update({
            where: { id },
            data: { status: EntryStatus.ARCHIVED },
          });
          return tx.paymentQrImage.create({
            data: {
              ownerId: request.currentUser.id,
              label,
              storagePath: uploaded.path,
              mimeType: uploaded.mimeType,
              sizeBytes: uploaded.sizeBytes,
            },
          });
        });
        return reply.code(201).send(await serializeQr(replacement));
      } catch (error) {
        await removeObject(storageBuckets().qrBucket, uploaded.path).catch(() => undefined);
        throw error;
      }
    },
  );

  app.delete(
    '/me/payment-qr-images/:id',
    { preHandler: [requireAuthenticatedUser, requireSousChefOrHeadChef] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const qr = await prisma.paymentQrImage.findFirst({
        where: { id, ownerId: request.currentUser.id, status: EntryStatus.ACTIVE },
        include: { _count: { select: { bills: true } } },
      });
      if (!qr) return reply.code(404).send({ message: 'Payment QR image not found' });
      if (qr._count.bills > 0) {
        await prisma.paymentQrImage.update({
          where: { id },
          data: { status: EntryStatus.ARCHIVED },
        });
      } else {
        await removeObject(storageBuckets().qrBucket, qr.storagePath);
        await prisma.paymentQrImage.delete({ where: { id } });
      }
      return reply.code(204).send();
    },
  );

  app.get(
    '/bills/:id/payment-qr-options',
    { preHandler: [requireAuthenticatedUser, requireSousChefOrHeadChef] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const bill = await prisma.bill.findUnique({
        where: { id },
        select: { createdById: true },
      });
      if (!bill) return reply.code(404).send({ message: 'Bill not found' });
      if (bill.createdById !== request.currentUser.id && !isHeadChef(request.currentUser)) {
        return reply.code(403).send({ message: 'Not allowed to edit this bill' });
      }
      const rows = await prisma.paymentQrImage.findMany({
        where: { ownerId: bill.createdById, status: EntryStatus.ACTIVE },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      return Promise.all(rows.map(serializeQr));
    },
  );
};
