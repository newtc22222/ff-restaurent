import type { FastifyInstance } from 'fastify';
import { EntryStatus, Prisma } from '@prisma/client';
import {
  requireAuthenticatedUser,
  requireHeadChef,
  requireSousChefOrHeadChef,
} from '../http/auth-guards.js';
import { prisma } from '../prisma.js';
import { isHeadChef } from '../roles.js';
import { publicRestaurantSelect } from '../restaurant-contract.js';
import {
  normalizeCatalogKey,
  normalizeDisplayText,
} from '../catalog-normalization.js';
import {
  normalizeVietnamAddressSnapshot,
  restaurantListQuerySchema,
  restaurantSchema,
  restaurantUpdateSchema,
} from '../schemas.js';
import {
  ensureRecommendedCollection,
  toggleFavoriteShortcut,
  toggleRecommendedShortcut,
} from '../collection-service.js';
import { normalizeSearchQuery } from '../search-normalization.js';
import { pageResult } from '../pagination.js';

type RestaurantCuisineInput = {
  cuisineType?: string;
  cuisineIds?: string[];
  primaryCuisineId?: string;
};

const invalidCuisineSelection = () =>
  Object.assign(new Error('Selected cuisines are invalid'), {
    statusCode: 400,
    code: 'CUISINE_SELECTION_INVALID',
  });

const resolveCuisineSelection = async (
  tx: Prisma.TransactionClient,
  input: RestaurantCuisineInput,
) => {
  if (input.cuisineIds && input.primaryCuisineId) {
    const cuisines = await tx.cuisine.findMany({
      where: { id: { in: input.cuisineIds } },
      select: { id: true, name: true },
    });
    if (cuisines.length !== input.cuisineIds.length) {
      throw invalidCuisineSelection();
    }
    const primary = cuisines.find(
      (cuisine) => cuisine.id === input.primaryCuisineId,
    );
    if (!primary) throw invalidCuisineSelection();
    return {
      primaryName: primary.name,
      joins: input.cuisineIds.map((cuisineId) => ({
        cuisineId,
        isPrimary: cuisineId === input.primaryCuisineId,
      })),
    };
  }

  if (!input.cuisineType) return undefined;
  const name = normalizeDisplayText(input.cuisineType);
  const cuisine = await tx.cuisine.upsert({
    where: { nameKey: normalizeCatalogKey(name) },
    update: {},
    create: {
      name,
      nameKey: normalizeCatalogKey(name),
      type: 'Legacy',
    },
    select: { id: true, name: true },
  });
  return {
    primaryName: cuisine.name,
    joins: [{ cuisineId: cuisine.id, isPrimary: true }],
  };
};

/**
 * Restaurant routes manage the directory, favorites, recommendations, and archive state.
 */
export const registerRestaurantRoutes = (app: FastifyInstance) => {
  app.get(
    '/restaurants',
    { preHandler: requireAuthenticatedUser },
    async (request) => {
      const query = restaurantListQuerySchema.parse(request.query);
      const requestedStatus =
        query.archive === 'archived'
          ? EntryStatus.ARCHIVED
          : query.archive === 'all'
            ? undefined
            : EntryStatus.ACTIVE;
      const status = isHeadChef(request.currentUser)
        ? requestedStatus
        : EntryStatus.ACTIVE;
      const where: Prisma.RestaurantEntryWhereInput = {
        status,
        searchText: query.search
          ? { contains: normalizeSearchQuery(query.search) }
          : undefined,
        diningAreaId: query.diningAreaId,
        isRecommended:
          query.recommended === undefined
            ? undefined
            : query.recommended === 'true',
        cuisines: query.primaryCuisineId
          ? {
              some: {
                cuisineId: query.primaryCuisineId,
                isPrimary: true,
              },
            }
          : query.cuisineId
            ? { some: { cuisineId: query.cuisineId } }
            : undefined,
        platformLinks: query.platform
          ? { some: { platform: query.platform } }
          : undefined,
        collections: query.collectionId
          ? {
              some: {
                collectionId: query.collectionId,
                collection: {
                  OR: [
                    { ownerId: request.currentUser.id },
                    { isPublic: true },
                    { shares: { some: { userId: request.currentUser.id } } },
                  ],
                },
              },
            }
          : undefined,
      };
      if (query.favorite !== undefined) {
        where.favorites =
          query.favorite === 'true'
            ? { some: { userId: request.currentUser.id } }
            : { none: { userId: request.currentUser.id } };
      }
      const orderBy: Prisma.RestaurantEntryOrderByWithRelationInput[] =
        query.sort === 'name-desc'
          ? [{ name: 'desc' }, { id: 'desc' }]
          : query.sort === 'created-desc'
            ? [{ createdAt: 'desc' }, { id: 'desc' }]
            : query.sort === 'created-asc'
              ? [{ createdAt: 'asc' }, { id: 'asc' }]
              : [{ name: 'asc' }, { id: 'asc' }];

      const restaurants = await prisma.restaurantEntry.findMany({
        where,
        orderBy,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
        take: query.limit + 1,
        select: {
          ...publicRestaurantSelect,
          favorites: {
            where: { userId: request.currentUser.id },
            select: { userId: true },
          },
        },
      });
      const visibleRows = restaurants.slice(0, query.limit);
      const feedbackAggregates = await prisma.feedback.groupBy({
        by: ['restaurantId'],
        where: { restaurantId: { in: visibleRows.map(({ id }) => id) } },
        _avg: { foodRating: true, serviceRating: true },
        _count: { _all: true },
      });
      const aggregateByRestaurant = new Map(
        feedbackAggregates.map((aggregate) => [
          aggregate.restaurantId,
          {
            foodRating: aggregate._avg.foodRating?.toNumber() ?? null,
            serviceRating: aggregate._avg.serviceRating?.toNumber() ?? null,
            feedbackCount: aggregate._count._all,
          },
        ]),
      );
      return pageResult(
        restaurants.map((restaurant) => ({
          ...restaurant,
          isFavoritedByMe: restaurant.favorites.length > 0,
          favorites: undefined,
          feedbackAggregates: aggregateByRestaurant.get(restaurant.id) ?? {
            foodRating: null,
            serviceRating: null,
            feedbackCount: 0,
          },
        })),
        query.limit,
      );
    },
  );

  app.post(
    '/restaurants',
    { preHandler: [requireAuthenticatedUser, requireSousChefOrHeadChef] },
    async (request, reply) => {
      const body = restaurantSchema.parse(request.body);
      const data = normalizeVietnamAddressSnapshot(body);
      const { platformLinks, cuisineIds, primaryCuisineId, ...restaurantData } =
        data;
      const recommendedCollection = restaurantData.isRecommended
        ? await ensureRecommendedCollection()
        : null;
      const created = await prisma.$transaction(async (tx) => {
        const cuisineSelection = await resolveCuisineSelection(tx, {
          cuisineType: restaurantData.cuisineType,
          cuisineIds,
          primaryCuisineId,
        });
        if (!cuisineSelection) throw invalidCuisineSelection();
        return tx.restaurantEntry.create({
          data: {
            ...restaurantData,
            cuisineType: cuisineSelection.primaryName,
            createdById: request.currentUser.id,
            platformLinks: {
              create: (platformLinks ?? []).map((link, sortOrder) => ({
                ...link,
                sortOrder,
              })),
            },
            cuisines: { create: cuisineSelection.joins },
            ...(recommendedCollection
              ? {
                  collections: {
                    create: { collectionId: recommendedCollection.id },
                  },
                }
              : {}),
          },
          select: publicRestaurantSelect,
        });
      });
      return reply.code(201).send(created);
    },
  );

  app.put(
    '/restaurants/:id',
    { preHandler: [requireAuthenticatedUser, requireSousChefOrHeadChef] },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = restaurantUpdateSchema.parse(request.body);
      const data = normalizeVietnamAddressSnapshot(body);
      const { platformLinks, cuisineIds, primaryCuisineId, ...restaurantData } =
        data;
      const recommendedCollection =
        restaurantData.isRecommended !== undefined
          ? await ensureRecommendedCollection()
          : null;
      return prisma.$transaction(async (tx) => {
        const cuisineSelection = await resolveCuisineSelection(tx, {
          cuisineType: restaurantData.cuisineType,
          cuisineIds,
          primaryCuisineId,
        });
        const updated = await tx.restaurantEntry.update({
          where: { id },
          data: {
            ...restaurantData,
            ...(cuisineSelection
              ? {
                  cuisineType: cuisineSelection.primaryName,
                  cuisines: {
                    deleteMany: {},
                    create: cuisineSelection.joins,
                  },
                }
              : {}),
            ...(platformLinks
              ? {
                  platformLinks: {
                    deleteMany: {},
                    create: platformLinks.map((link, sortOrder) => ({
                      ...link,
                      sortOrder,
                    })),
                  },
                }
              : {}),
          },
          select: publicRestaurantSelect,
        });
        if (recommendedCollection) {
          if (restaurantData.isRecommended) {
            await tx.collectionRestaurant.upsert({
              where: {
                collectionId_restaurantId: {
                  collectionId: recommendedCollection.id,
                  restaurantId: id,
                },
              },
              update: {},
              create: {
                collectionId: recommendedCollection.id,
                restaurantId: id,
              },
            });
          } else {
            await tx.collectionRestaurant.deleteMany({
              where: {
                collectionId: recommendedCollection.id,
                restaurantId: id,
              },
            });
          }
        }
        return updated;
      });
    },
  );

  app.patch(
    '/restaurants/:id/archive',
    { preHandler: [requireAuthenticatedUser, requireHeadChef] },
    async (request) => {
      const { id } = request.params as { id: string };
      return prisma.restaurantEntry.update({
        where: { id },
        data: { status: EntryStatus.ARCHIVED },
        select: publicRestaurantSelect,
      });
    },
  );

  app.patch(
    '/restaurants/:id/restore',
    { preHandler: [requireAuthenticatedUser, requireHeadChef] },
    async (request) => {
      const { id } = request.params as { id: string };
      return prisma.restaurantEntry.update({
        where: { id },
        data: { status: EntryStatus.ACTIVE },
        select: publicRestaurantSelect,
      });
    },
  );

  app.post(
    '/restaurants/:id/favorite',
    { preHandler: requireAuthenticatedUser },
    async (request) => {
      const { id } = request.params as { id: string };
      return {
        favorited: await toggleFavoriteShortcut(request.currentUser.id, id),
      };
    },
  );

  app.patch(
    '/restaurants/:id/recommend',
    { preHandler: [requireAuthenticatedUser, requireSousChefOrHeadChef] },
    async (request) => {
      const { id } = request.params as { id: string };
      const recommended = await toggleRecommendedShortcut(id);
      return prisma.restaurantEntry
        .findUniqueOrThrow({
          where: { id },
          select: publicRestaurantSelect,
        })
        .then((entry) => ({ ...entry, isRecommended: recommended }));
    },
  );
};
