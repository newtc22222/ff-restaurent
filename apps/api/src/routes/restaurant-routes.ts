import type { FastifyInstance } from 'fastify';
import { EntryStatus, Prisma } from '@prisma/client';
import {
  requireAuthenticatedUser,
  requireHeadChef,
  requireSousChefOrHeadChef,
} from '../http/auth-guards.js';
import { prisma } from '../prisma.js';
import { isHeadChef } from '../roles.js';
import {
  publicRestaurantSelect,
  serializePublicRestaurant,
} from '../restaurant-contract.js';
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
  ensureFavoritesCollection,
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
      select: { id: true },
    });
    if (cuisines.length !== input.cuisineIds.length) {
      throw invalidCuisineSelection();
    }
    const primary = cuisines.find(
      (cuisine) => cuisine.id === input.primaryCuisineId,
    );
    if (!primary) throw invalidCuisineSelection();
    return {
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
    select: { id: true },
  });
  return { joins: [{ cuisineId: cuisine.id, isPrimary: true }] };
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
        diningAreaId: query.diningAreaId,
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
      };
      const filters: Prisma.RestaurantEntryWhereInput[] = [];
      if (query.collectionId) {
        filters.push({
          collections: {
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
          },
        });
      }
      if (query.recommended !== undefined) {
        const recommendedFilter = {
          collection: { systemType: 'RECOMMENDED' as const },
        };
        filters.push({
          collections:
            query.recommended === 'true'
              ? { some: recommendedFilter }
              : { none: recommendedFilter },
        });
      }
      if (query.favorite !== undefined) {
        const favoriteFilter = {
          collection: {
            systemType: 'FAVORITES' as const,
            ownerId: request.currentUser.id,
          },
        };
        const favoriteClause: Prisma.RestaurantEntryWhereInput = {
          collections:
            query.favorite === 'true'
              ? { some: favoriteFilter }
              : { none: favoriteFilter },
        };
        filters.push(favoriteClause);
      }
      if (filters.length > 0) where.AND = filters;
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
        select: publicRestaurantSelect,
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
          ...serializePublicRestaurant(restaurant, request.currentUser.id),
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
      const {
        platformLinks,
        cuisineIds,
        primaryCuisineId,
        cuisineType,
        isRecommended,
        isFavorite,
        ...restaurantData
      } = data;
      const recommendedCollection = isRecommended
        ? await ensureRecommendedCollection()
        : null;
      const favoritesCollection = isFavorite
        ? await ensureFavoritesCollection(request.currentUser.id)
        : null;
      const created = await prisma.$transaction(async (tx) => {
        const cuisineSelection = await resolveCuisineSelection(tx, {
          cuisineType,
          cuisineIds,
          primaryCuisineId,
        });
        if (!cuisineSelection) throw invalidCuisineSelection();
        return tx.restaurantEntry.create({
          data: {
            ...restaurantData,
            createdById: request.currentUser.id,
            platformLinks: {
              create: (platformLinks ?? []).map((link, sortOrder) => ({
                ...link,
                sortOrder,
              })),
            },
            cuisines: { create: cuisineSelection.joins },
            ...(recommendedCollection || favoritesCollection
              ? {
                  collections: {
                    create: [recommendedCollection, favoritesCollection]
                      .filter((collection) => collection !== null)
                      .map((collection) => ({ collectionId: collection.id })),
                  },
                }
              : {}),
          },
          select: publicRestaurantSelect,
        });
      });
      return reply
        .code(201)
        .send(serializePublicRestaurant(created, request.currentUser.id));
    },
  );

  app.put(
    '/restaurants/:id',
    { preHandler: [requireAuthenticatedUser, requireSousChefOrHeadChef] },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = restaurantUpdateSchema.parse(request.body);
      const data = normalizeVietnamAddressSnapshot(body);
      const {
        platformLinks,
        cuisineIds,
        primaryCuisineId,
        cuisineType,
        isRecommended,
        isFavorite,
        ...restaurantData
      } = data;
      const recommendedCollection =
        isRecommended !== undefined
          ? await ensureRecommendedCollection()
          : null;
      const favoritesCollection =
        isFavorite !== undefined
          ? await ensureFavoritesCollection(request.currentUser.id)
          : null;
      return prisma.$transaction(async (tx) => {
        const cuisineSelection = await resolveCuisineSelection(tx, {
          cuisineType,
          cuisineIds,
          primaryCuisineId,
        });
        await tx.restaurantEntry.update({
          where: { id },
          data: {
            ...restaurantData,
            ...(cuisineSelection
              ? {
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
          if (isRecommended) {
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
        if (favoritesCollection) {
          if (isFavorite) {
            await tx.collectionRestaurant.upsert({
              where: {
                collectionId_restaurantId: {
                  collectionId: favoritesCollection.id,
                  restaurantId: id,
                },
              },
              update: {},
              create: {
                collectionId: favoritesCollection.id,
                restaurantId: id,
              },
            });
          } else {
            await tx.collectionRestaurant.deleteMany({
              where: { collectionId: favoritesCollection.id, restaurantId: id },
            });
          }
        }
        const current = await tx.restaurantEntry.findUniqueOrThrow({
          where: { id },
          select: publicRestaurantSelect,
        });
        return serializePublicRestaurant(current, request.currentUser.id);
      });
    },
  );

  app.patch(
    '/restaurants/:id/archive',
    { preHandler: [requireAuthenticatedUser, requireHeadChef] },
    async (request) => {
      const { id } = request.params as { id: string };
      const restaurant = await prisma.restaurantEntry.update({
        where: { id },
        data: { status: EntryStatus.ARCHIVED },
        select: publicRestaurantSelect,
      });
      return serializePublicRestaurant(restaurant, request.currentUser.id);
    },
  );

  app.patch(
    '/restaurants/:id/restore',
    { preHandler: [requireAuthenticatedUser, requireHeadChef] },
    async (request) => {
      const { id } = request.params as { id: string };
      const restaurant = await prisma.restaurantEntry.update({
        where: { id },
        data: { status: EntryStatus.ACTIVE },
        select: publicRestaurantSelect,
      });
      return serializePublicRestaurant(restaurant, request.currentUser.id);
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
        .then((entry) => ({
          ...serializePublicRestaurant(entry, request.currentUser.id),
          isRecommended: recommended,
        }));
    },
  );
};
