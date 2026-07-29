import type { FastifyInstance, FastifyRequest } from 'fastify';

import { badRequest } from '../http/app-error.js';
import {
  requireAuthenticatedUser,
  requireSousChefOrHeadChef,
} from '../http/auth-guards.js';
import {
  type RestaurantImageKind,
  clearRestaurantImage,
  clearUserAvatar,
  createQrImage,
  deleteQrImage,
  listBillQrOptions,
  listOwnQrImages,
  parseQrLabel,
  renameQrImage,
  replaceQrImage,
  replaceRestaurantImage,
  replaceUserAvatar,
} from '../services/media-service.js';

/**
 * Media routes keep the Supabase service role entirely behind app
 * authorization. Multipart extraction stays here because it is an HTTP
 * concern; storage and persistence live in media-service.
 */

const multipartFile = async (request: FastifyRequest) => {
  const part = await request.file();
  if (!part) throw badRequest('IMAGE_REQUIRED', 'An image file is required');
  return part;
};

const fieldValue = (
  part: Awaited<ReturnType<typeof multipartFile>>,
  key: string,
) => {
  const field = part.fields[key];
  if (!field || Array.isArray(field) || field.type !== 'field') return '';
  return String(field.value ?? '').trim();
};

const QR_NOT_FOUND = { message: 'Payment QR image not found' };

export const registerMediaRoutes = (app: FastifyInstance) => {
  app.put(
    '/me/avatar',
    { preHandler: requireAuthenticatedUser },
    async (request) => {
      const part = await multipartFile(request);
      return replaceUserAvatar(request.currentUser.id, part, request.log);
    },
  );

  app.delete(
    '/me/avatar',
    { preHandler: requireAuthenticatedUser },
    async (request, reply) => {
      await clearUserAvatar(request.currentUser.id, request.log);
      return reply.code(204).send();
    },
  );

  for (const kind of [
    'logo',
    'banner',
  ] as const satisfies readonly RestaurantImageKind[]) {
    app.put(
      `/restaurants/:id/${kind}`,
      { preHandler: [requireAuthenticatedUser, requireSousChefOrHeadChef] },
      async (request, reply) => {
        const { id } = request.params as { id: string };
        /*
         * Read the body only after the restaurant is known to exist, so an
         * unknown id still returns 404 rather than a multipart error.
         */
        const result = await replaceRestaurantImage(
          id,
          kind,
          () => multipartFile(request),
          request.log,
        );
        if (!result)
          return reply.code(404).send({ message: 'Restaurant not found' });
        return result;
      },
    );

    app.delete(
      `/restaurants/:id/${kind}`,
      { preHandler: [requireAuthenticatedUser, requireSousChefOrHeadChef] },
      async (request, reply) => {
        const { id } = request.params as { id: string };
        const result = await clearRestaurantImage(id, kind, request.log);
        if (!result)
          return reply.code(404).send({ message: 'Restaurant not found' });
        return reply.code(204).send();
      },
    );
  }

  app.get(
    '/me/payment-qr-images',
    { preHandler: [requireAuthenticatedUser, requireSousChefOrHeadChef] },
    async (request) => listOwnQrImages(request.currentUser.id),
  );

  app.post(
    '/me/payment-qr-images',
    { preHandler: [requireAuthenticatedUser, requireSousChefOrHeadChef] },
    async (request, reply) => {
      const part = await multipartFile(request);
      const label = parseQrLabel(fieldValue(part, 'label'));
      const created = await createQrImage(request.currentUser.id, part, label);
      return reply.code(201).send(created);
    },
  );

  app.patch(
    '/me/payment-qr-images/:id',
    { preHandler: [requireAuthenticatedUser, requireSousChefOrHeadChef] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const label = parseQrLabel((request.body as { label?: unknown })?.label);
      const updated = await renameQrImage(request.currentUser.id, id, label);
      if (!updated) return reply.code(404).send(QR_NOT_FOUND);
      return updated;
    },
  );

  app.post(
    '/me/payment-qr-images/:id/replacement',
    { preHandler: [requireAuthenticatedUser, requireSousChefOrHeadChef] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      /*
       * The multipart body is only read once the image is confirmed to belong
       * to the caller, preserving the original ordering: a 404 for someone
       * else's image must not depend on the upload succeeding.
       */
      const replacement = await replaceQrImage(
        request.currentUser.id,
        id,
        async () => {
          const part = await multipartFile(request);
          return { part, label: fieldValue(part, 'label') };
        },
      );
      if (!replacement) return reply.code(404).send(QR_NOT_FOUND);
      return reply.code(201).send(replacement);
    },
  );

  app.delete(
    '/me/payment-qr-images/:id',
    { preHandler: [requireAuthenticatedUser, requireSousChefOrHeadChef] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await deleteQrImage(request.currentUser.id, id);
      if (!result) return reply.code(404).send(QR_NOT_FOUND);
      return reply.code(204).send();
    },
  );

  app.get(
    '/bills/:id/payment-qr-options',
    { preHandler: [requireAuthenticatedUser, requireSousChefOrHeadChef] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await listBillQrOptions(id, request.currentUser);
      if (result.outcome === 'not-found')
        return reply.code(404).send({ message: 'Bill not found' });
      if (result.outcome === 'forbidden')
        return reply
          .code(403)
          .send({ message: 'Not allowed to edit this bill' });
      return result.images;
    },
  );
};
