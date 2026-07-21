import { CollectionSystemType, EntryStatus, Prisma } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { ensureDefaultCollections } from '../collection-service.js';
import { requireAuthenticatedUser } from '../http/auth-guards.js';
import { prisma } from '../prisma.js';
import {
  buildPublicRestaurantSelect,
  serializePublicRestaurant,
} from '../restaurant-contract.js';
import { isHeadChef, isSousChefOrAbove } from '../roles.js';
import {
  catalogQuerySchema,
  collectionSchema,
  collectionShareSchema,
  collectionUpdateSchema,
} from '../schemas.js';
import { normalizeSearchQuery } from '../search-normalization.js';
import { pageResult } from '../pagination.js';

const collectionSelect = {
  id: true,
  name: true,
  description: true,
  isPublic: true,
  systemType: true,
  ownerId: true,
  owner: { select: { id: true, username: true, name: true } },
  createdAt: true,
  updatedAt: true,
  _count: { select: { restaurants: true, shares: true } },
} satisfies Prisma.CollectionSelect;

const visibleWhere = (userId: string): Prisma.CollectionWhereInput => ({
  OR: [
    { ownerId: userId },
    { isPublic: true },
    { shares: { some: { userId } } },
  ],
});

const httpError = (statusCode: number, code: string, message: string) =>
  Object.assign(new Error(message), { statusCode, code });

const getVisibleCollection = async (id: string, userId: string) => {
  const collection = await prisma.collection.findFirst({
    where: { id, ...visibleWhere(userId) },
    select: collectionSelect,
  });
  if (!collection)
    throw httpError(404, 'COLLECTION_NOT_FOUND', 'Collection not found');
  return collection;
};

const getCollection = async (id: string) => {
  const collection = await prisma.collection.findUnique({ where: { id } });
  if (!collection)
    throw httpError(404, 'COLLECTION_NOT_FOUND', 'Collection not found');
  return collection;
};

const requireCustomOwner = async (id: string, userId: string) => {
  const collection = await getCollection(id);
  if (collection.systemType) {
    throw httpError(
      409,
      'SYSTEM_COLLECTION_IMMUTABLE',
      'System collection metadata cannot be changed',
    );
  }
  if (collection.ownerId !== userId) {
    throw httpError(
      403,
      'COLLECTION_OWNER_REQUIRED',
      'Collection owner required',
    );
  }
  return collection;
};

const requireMembershipManager = async (
  id: string,
  user: Parameters<typeof isSousChefOrAbove>[0],
) => {
  const collection = await getCollection(id);
  if (collection.systemType === CollectionSystemType.RECOMMENDED) {
    if (!isSousChefOrAbove(user)) {
      throw httpError(403, 'CHEF_REQUIRED', 'A chef must manage Recommended');
    }
    return collection;
  }
  if (collection.ownerId !== user.id) {
    throw httpError(
      403,
      'COLLECTION_OWNER_REQUIRED',
      'Collection owner required',
    );
  }
  return collection;
};

export const registerCollectionRoutes = (app: FastifyInstance) => {
  app.get(
    '/collections',
    { preHandler: requireAuthenticatedUser },
    async (request) => {
      await ensureDefaultCollections(request.currentUser.id);
      const query = catalogQuerySchema.parse(request.query);
      const visibilityFilter: Prisma.CollectionWhereInput =
        query.visibility === 'owned'
          ? { ownerId: request.currentUser.id }
          : query.visibility === 'public'
            ? { isPublic: true }
            : query.visibility === 'shared'
              ? { shares: { some: { userId: request.currentUser.id } } }
              : {};
      const orderBy: Prisma.CollectionOrderByWithRelationInput[] =
        query.sort === 'name-desc'
          ? [{ name: 'desc' }, { id: 'desc' }]
          : query.sort === 'created-asc'
            ? [{ createdAt: 'asc' }, { id: 'asc' }]
            : query.sort === 'name-asc'
              ? [{ name: 'asc' }, { id: 'asc' }]
              : [{ createdAt: 'desc' }, { id: 'desc' }];
      const items = await prisma.collection.findMany({
        where: {
          AND: [
            visibleWhere(request.currentUser.id),
            visibilityFilter,
            query.systemType === 'custom'
              ? { systemType: null }
              : query.systemType
                ? { systemType: query.systemType }
                : {},
            ...(query.search
              ? [
                  {
                    searchText: {
                      contains: normalizeSearchQuery(query.search),
                    },
                  },
                ]
              : []),
          ],
        },
        orderBy,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
        take: query.limit + 1,
        select: collectionSelect,
      });
      return pageResult(items, query.limit);
    },
  );

  app.post(
    '/collections',
    { preHandler: requireAuthenticatedUser },
    async (request, reply) => {
      const body = collectionSchema.parse(request.body);
      const collection = await prisma.collection.create({
        data: {
          name: body.name,
          description: body.description || null,
          isPublic: body.isPublic,
          ownerId: request.currentUser.id,
        },
        select: collectionSelect,
      });
      return reply.code(201).send(collection);
    },
  );

  app.get(
    '/collections/:id',
    { preHandler: requireAuthenticatedUser },
    async (request) => {
      const { id } = request.params as { id: string };
      return getVisibleCollection(id, request.currentUser.id);
    },
  );

  app.put(
    '/collections/:id',
    { preHandler: requireAuthenticatedUser },
    async (request) => {
      const { id } = request.params as { id: string };
      await requireCustomOwner(id, request.currentUser.id);
      const body = collectionUpdateSchema.parse(request.body);
      return prisma.collection.update({
        where: { id },
        data: {
          ...body,
          ...(body.description !== undefined
            ? { description: body.description || null }
            : {}),
        },
        select: collectionSelect,
      });
    },
  );

  app.delete(
    '/collections/:id',
    { preHandler: requireAuthenticatedUser },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await requireCustomOwner(id, request.currentUser.id);
      await prisma.collection.delete({ where: { id } });
      return reply.code(204).send();
    },
  );

  app.get(
    '/collections/:id/restaurants',
    { preHandler: requireAuthenticatedUser },
    async (request) => {
      const { id } = request.params as { id: string };
      await getVisibleCollection(id, request.currentUser.id);
      const query = catalogQuerySchema.parse(request.query);
      const orderBy: Prisma.CollectionRestaurantOrderByWithRelationInput[] =
        query.sort === 'name-desc'
          ? [{ restaurant: { name: 'desc' } }, { restaurantId: 'desc' }]
          : query.sort === 'name-asc'
            ? [{ restaurant: { name: 'asc' } }, { restaurantId: 'asc' }]
            : query.sort === 'created-asc'
              ? [{ createdAt: 'asc' }, { restaurantId: 'asc' }]
              : [{ createdAt: 'desc' }, { restaurantId: 'desc' }];
      const items = await prisma.collectionRestaurant.findMany({
        where: {
          collectionId: id,
          restaurant: {
            status: isHeadChef(request.currentUser)
              ? undefined
              : EntryStatus.ACTIVE,
            OR: query.search
              ? [
                  {
                    searchText: {
                      contains: normalizeSearchQuery(query.search),
                    },
                  },
                  {
                    cuisines: {
                      some: {
                        cuisine: {
                          searchText: {
                            contains: normalizeSearchQuery(query.search),
                          },
                        },
                      },
                    },
                  },
                ]
              : undefined,
          },
        },
        orderBy,
        ...(query.cursor
          ? {
              cursor: {
                collectionId_restaurantId: {
                  collectionId: id,
                  restaurantId: query.cursor,
                },
              },
              skip: 1,
            }
          : {}),
        take: query.limit + 1,
        select: {
          restaurantId: true,
          createdAt: true,
          restaurant: {
            select: buildPublicRestaurantSelect(request.currentUser.id),
          },
        },
      });
      const hasNextPage = items.length > query.limit;
      const page = items.slice(0, query.limit);
      return {
        items: page.map(({ restaurant, createdAt }) => ({
          ...serializePublicRestaurant(restaurant, request.currentUser.id),
          addedAt: createdAt,
        })),
        pageInfo: {
          endCursor: hasNextPage ? (page.at(-1)?.restaurantId ?? null) : null,
          hasNextPage,
        },
      };
    },
  );

  app.post(
    '/collections/:id/restaurants/:restaurantId',
    { preHandler: requireAuthenticatedUser },
    async (request, reply) => {
      const { id, restaurantId } = request.params as {
        id: string;
        restaurantId: string;
      };
      await requireMembershipManager(id, request.currentUser);
      await prisma.$transaction(async (tx) => {
        await tx.restaurantEntry.findUniqueOrThrow({
          where: { id: restaurantId },
          select: { id: true },
        });
        await tx.collectionRestaurant.upsert({
          where: {
            collectionId_restaurantId: { collectionId: id, restaurantId },
          },
          update: {},
          create: { collectionId: id, restaurantId },
        });
      });
      return reply.code(201).send({ added: true });
    },
  );

  app.delete(
    '/collections/:id/restaurants/:restaurantId',
    { preHandler: requireAuthenticatedUser },
    async (request, reply) => {
      const { id, restaurantId } = request.params as {
        id: string;
        restaurantId: string;
      };
      await requireMembershipManager(id, request.currentUser);
      await prisma.$transaction(async (tx) => {
        await tx.collectionRestaurant.deleteMany({
          where: { collectionId: id, restaurantId },
        });
      });
      return reply.code(204).send();
    },
  );

  app.get(
    '/collections/:id/shares',
    { preHandler: requireAuthenticatedUser },
    async (request) => {
      const { id } = request.params as { id: string };
      await requireCustomOwner(id, request.currentUser.id);
      const query = catalogQuerySchema.parse(request.query);
      const items = await prisma.collectionShare.findMany({
        where: {
          collectionId: id,
          user: query.search
            ? {
                searchText: {
                  contains: normalizeSearchQuery(query.search),
                },
              }
            : undefined,
        },
        orderBy: [{ createdAt: 'desc' }, { userId: 'asc' }],
        ...(query.cursor
          ? {
              cursor: {
                collectionId_userId: { collectionId: id, userId: query.cursor },
              },
              skip: 1,
            }
          : {}),
        take: query.limit + 1,
        select: {
          userId: true,
          createdAt: true,
          user: { select: { id: true, username: true, name: true } },
        },
      });
      const hasNextPage = items.length > query.limit;
      const page = items.slice(0, query.limit);
      return {
        items: page.map(({ user, createdAt }) => ({
          ...user,
          sharedAt: createdAt,
        })),
        pageInfo: {
          endCursor: hasNextPage ? (page.at(-1)?.userId ?? null) : null,
          hasNextPage,
        },
      };
    },
  );

  app.post(
    '/collections/:id/shares',
    { preHandler: requireAuthenticatedUser },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await requireCustomOwner(id, request.currentUser.id);
      const { userId } = collectionShareSchema.parse(request.body);
      if (userId === request.currentUser.id) {
        throw httpError(
          400,
          'COLLECTION_OWNER_SHARE_INVALID',
          'An owner cannot share a collection with themselves',
        );
      }
      await prisma.collectionShare.upsert({
        where: { collectionId_userId: { collectionId: id, userId } },
        update: {},
        create: { collectionId: id, userId },
      });
      return reply.code(201).send({ shared: true });
    },
  );

  app.delete(
    '/collections/:id/shares/:userId',
    { preHandler: requireAuthenticatedUser },
    async (request, reply) => {
      const { id, userId } = request.params as { id: string; userId: string };
      await requireCustomOwner(id, request.currentUser.id);
      await prisma.collectionShare.deleteMany({
        where: { collectionId: id, userId },
      });
      return reply.code(204).send();
    },
  );
};
