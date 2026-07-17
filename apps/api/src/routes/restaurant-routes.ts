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
  restaurantCollectionsSchema,
  restaurantListQuerySchema,
  restaurantSchema,
  restaurantUpdateSchema,
} from '../schemas.js';
import {
  ensureDefaultCollections,
  ensureRecommendedCollection,
  getVisibleRestaurantCollections,
  reconcileRestaurantCollections,
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

  app.get(
    '/restaurants/:id',
    { preHandler: requireAuthenticatedUser },
    async (request) => {
      const { id } = request.params as { id: string };
      await ensureDefaultCollections(request.currentUser.id);
      const restaurant = await prisma.restaurantEntry.findFirst({
        where: {
          id,
          status: isHeadChef(request.currentUser)
            ? undefined
            : EntryStatus.ACTIVE,
        },
        select: {
          ...publicRestaurantSelect,
          favorites: {
            where: { userId: request.currentUser.id },
            select: { userId: true },
          },
        },
      });
      if (!restaurant) {
        throw Object.assign(new Error('Restaurant not found'), {
          statusCode: 404,
          code: 'RESTAURANT_NOT_FOUND',
        });
      }
      const collections = await getVisibleRestaurantCollections(
        request.currentUser.id,
        id,
      );
      return {
        ...restaurant,
        favorites: undefined,
        isFavoritedByMe: restaurant.favorites.length > 0,
        collections,
      };
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
        collectionIds,
        ...restaurantData
      } = data;
      const defaults = await ensureDefaultCollections(request.currentUser.id);
      const selectedCollectionIds = new Set(collectionIds ?? []);
      if (restaurantData.isRecommended) {
        selectedCollectionIds.add(defaults.recommended.id);
      }
      const created = await prisma.$transaction(async (tx) => {
        const cuisineSelection = await resolveCuisineSelection(tx, {
          cuisineType: restaurantData.cuisineType,
          cuisineIds,
          primaryCuisineId,
        });
        if (!cuisineSelection) throw invalidCuisineSelection();
        const entry = await tx.restaurantEntry.create({
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
          },
          select: { id: true },
        });
        await reconcileRestaurantCollections(
          tx,
          request.currentUser,
          entry.id,
          [...selectedCollectionIds],
        );
        return tx.restaurantEntry.findUniqueOrThrow({
          where: { id: entry.id },
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
      const {
        platformLinks,
        cuisineIds,
        primaryCuisineId,
        collectionIds,
        ...restaurantData
      } = data;
      if (collectionIds) {
        await ensureDefaultCollections(request.currentUser.id);
      }
      const recommendedCollection =
        collectionIds === undefined &&
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
        if (collectionIds) {
          await reconcileRestaurantCollections(
            tx,
            request.currentUser,
            id,
            collectionIds,
          );
          return tx.restaurantEntry.findUniqueOrThrow({
            where: { id },
            select: publicRestaurantSelect,
          });
        }
        return updated;
      });
    },
  );

  app.put(
    '/restaurants/:id/collections',
    { preHandler: requireAuthenticatedUser },
    async (request) => {
      const { id } = request.params as { id: string };
      const { collectionIds } = restaurantCollectionsSchema.parse(request.body);
      await ensureDefaultCollections(request.currentUser.id);
      return prisma.$transaction(async (tx) => {
        await tx.restaurantEntry.findUniqueOrThrow({
          where: { id },
          select: { id: true },
        });
        await reconcileRestaurantCollections(
          tx,
          request.currentUser,
          id,
          collectionIds,
        );
        return {
          collections: await tx.collection.findMany({
            where: {
              id: { in: collectionIds },
              restaurants: { some: { restaurantId: id } },
            },
            orderBy: [{ systemType: 'desc' }, { name: 'asc' }],
            select: {
              id: true,
              name: true,
              description: true,
              isPublic: true,
              systemType: true,
              ownerId: true,
            },
          }),
        };
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
