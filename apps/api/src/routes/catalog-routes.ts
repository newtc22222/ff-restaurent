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
import { normalizeSearchQuery } from '../search-normalization.js';
import { pageResult } from '../pagination.js';

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
      const orderBy: Prisma.CuisineOrderByWithRelationInput[] =
        query.sort === 'name-desc'
          ? [{ nameKey: 'desc' }, { id: 'desc' }]
          : query.sort === 'created-desc'
            ? [{ createdAt: 'desc' }, { id: 'desc' }]
            : query.sort === 'created-asc'
              ? [{ createdAt: 'asc' }, { id: 'asc' }]
              : [{ nameKey: 'asc' }, { id: 'asc' }];
      const items = await prisma.cuisine.findMany({
        where: {
          searchText: query.search
            ? { contains: normalizeSearchQuery(query.search) }
            : undefined,
          type: query.type
            ? { equals: query.type, mode: 'insensitive' }
            : undefined,
        },
        orderBy,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
        take: query.limit + 1,
        select: cuisineSelect,
      });
      return pageResult(items, query.limit);
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
      const orderBy: Prisma.DiningAreaOrderByWithRelationInput[] =
        query.sort === 'name-desc'
          ? [{ normalizedKey: 'desc' }, { id: 'desc' }]
          : query.sort === 'created-desc'
            ? [{ createdAt: 'desc' }, { id: 'desc' }]
            : query.sort === 'created-asc'
              ? [{ createdAt: 'asc' }, { id: 'asc' }]
              : [{ normalizedKey: 'asc' }, { id: 'asc' }];
      const items = await prisma.diningArea.findMany({
        where: {
          searchText: query.search
            ? { contains: normalizeSearchQuery(query.search) }
            : undefined,
          provinceCode: query.provinceCode,
        },
        orderBy,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
        take: query.limit + 1,
        select: diningAreaSelect,
      });
      return pageResult(items, query.limit);
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
