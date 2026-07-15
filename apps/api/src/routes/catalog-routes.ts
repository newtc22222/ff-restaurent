import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import {
  diningAreaKey,
  normalizeCatalogKey,
  normalizeDisplayText,
} from '../catalog-normalization.js';
import {
  requireAuthenticatedUser,
  requireSousChefOrHeadChef,
} from '../http/auth-guards.js';
import { prisma } from '../prisma.js';
import {
  catalogQuerySchema,
  cuisineSchema,
  diningAreaSchema,
  diningAreaUpdateSchema,
  normalizeVietnamAddressSnapshot,
} from '../schemas.js';

const conflict = (code: string, message: string) =>
  Object.assign(new Error(message), { statusCode: 409, code });

const cuisineSelect = {
  id: true,
  name: true,
  type: true,
  description: true,
} satisfies Prisma.CuisineSelect;

const diningAreaSelect = {
  id: true,
  name: true,
  address: true,
  addressLine: true,
  provinceCode: true,
  provinceName: true,
  wardCode: true,
  wardName: true,
  description: true,
} satisfies Prisma.DiningAreaSelect;

export const registerCatalogRoutes = (app: FastifyInstance) => {
  app.get(
    '/cuisines',
    { preHandler: requireAuthenticatedUser },
    async (request) => {
      const query = catalogQuerySchema.parse(request.query);
      const items = await prisma.cuisine.findMany({
        where: query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { type: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : undefined,
        orderBy: [{ nameKey: 'asc' }, { id: 'asc' }],
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
        take: query.limit + 1,
        select: cuisineSelect,
      });
      const hasNextPage = items.length > query.limit;
      const page = items.slice(0, query.limit);
      return {
        items: page,
        pageInfo: {
          endCursor: hasNextPage ? (page.at(-1)?.id ?? null) : null,
          hasNextPage,
        },
      };
    },
  );

  app.post(
    '/cuisines',
    { preHandler: [requireAuthenticatedUser, requireSousChefOrHeadChef] },
    async (request, reply) => {
      const body = cuisineSchema.parse(request.body);
      return reply.code(201).send(
        await prisma.cuisine.create({
          data: {
            name: normalizeDisplayText(body.name),
            nameKey: normalizeCatalogKey(body.name),
            type: normalizeDisplayText(body.type),
            description: body.description || null,
          },
          select: cuisineSelect,
        }),
      );
    },
  );

  app.put(
    '/cuisines/:id',
    { preHandler: [requireAuthenticatedUser, requireSousChefOrHeadChef] },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = cuisineSchema.partial().parse(request.body);
      return prisma.cuisine.update({
        where: { id },
        data: {
          ...(body.name
            ? {
                name: normalizeDisplayText(body.name),
                nameKey: normalizeCatalogKey(body.name),
              }
            : {}),
          ...(body.type ? { type: normalizeDisplayText(body.type) } : {}),
          ...(body.description !== undefined
            ? { description: body.description || null }
            : {}),
        },
        select: cuisineSelect,
      });
    },
  );

  app.delete(
    '/cuisines/:id',
    { preHandler: [requireAuthenticatedUser, requireSousChefOrHeadChef] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const references = await prisma.restaurantCuisine.count({
        where: { cuisineId: id },
      });
      if (references > 0) {
        throw conflict(
          'CUISINE_IN_USE',
          'Cuisine cannot be deleted while restaurants reference it',
        );
      }
      await prisma.cuisine.delete({ where: { id } });
      return reply.code(204).send();
    },
  );

  app.get(
    '/dining-areas',
    { preHandler: requireAuthenticatedUser },
    async (request) => {
      const query = catalogQuerySchema.parse(request.query);
      const items = await prisma.diningArea.findMany({
        where: query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { address: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : undefined,
        orderBy: [{ normalizedKey: 'asc' }, { id: 'asc' }],
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
        take: query.limit + 1,
        select: diningAreaSelect,
      });
      const hasNextPage = items.length > query.limit;
      const page = items.slice(0, query.limit);
      return {
        items: page,
        pageInfo: {
          endCursor: hasNextPage ? (page.at(-1)?.id ?? null) : null,
          hasNextPage,
        },
      };
    },
  );

  app.post(
    '/dining-areas',
    { preHandler: [requireAuthenticatedUser, requireSousChefOrHeadChef] },
    async (request, reply) => {
      const body = normalizeVietnamAddressSnapshot(
        diningAreaSchema.parse(request.body),
      );
      const name = normalizeDisplayText(body.name);
      return reply.code(201).send(
        await prisma.diningArea.create({
          data: {
            ...body,
            name,
            description: body.description || null,
            normalizedKey: diningAreaKey(name, body.address),
          },
          select: diningAreaSelect,
        }),
      );
    },
  );

  app.put(
    '/dining-areas/:id',
    { preHandler: [requireAuthenticatedUser, requireSousChefOrHeadChef] },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = normalizeVietnamAddressSnapshot(
        diningAreaUpdateSchema.parse(request.body),
      );
      const existing = await prisma.diningArea.findUniqueOrThrow({
        where: { id },
      });
      const name = normalizeDisplayText(body.name ?? existing.name);
      const address = body.address ?? existing.address;
      return prisma.diningArea.update({
        where: { id },
        data: {
          ...body,
          name,
          normalizedKey: diningAreaKey(name, address),
          ...(body.description !== undefined
            ? { description: body.description || null }
            : {}),
        },
        select: diningAreaSelect,
      });
    },
  );

  app.delete(
    '/dining-areas/:id',
    { preHandler: [requireAuthenticatedUser, requireSousChefOrHeadChef] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const references = await prisma.restaurantEntry.count({
        where: { diningAreaId: id },
      });
      if (references > 0) {
        throw conflict(
          'DINING_AREA_IN_USE',
          'Dining Area cannot be deleted while restaurants reference it',
        );
      }
      await prisma.diningArea.delete({ where: { id } });
      return reply.code(204).send();
    },
  );
};
