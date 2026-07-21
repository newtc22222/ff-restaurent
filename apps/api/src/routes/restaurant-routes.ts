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
  restaurantCollectionsSchema,
  restaurantListQuerySchema,
  restaurantSchema,
  restaurantUpdateSchema,
} from '../schemas.js';
import {
  ensureDefaultCollections,
  getVisibleRestaurantCollections,
  reconcileRestaurantCollections,
  toggleFavoriteShortcut,
  toggleRecommendedShortcut,
} from '../collection-service.js';
import { normalizeSearchQuery } from '../search-normalization.js';
import { cursorPageResult } from '../pagination.js';

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
      const collectionFilters: Prisma.RestaurantEntryWhereInput[] = [];
      if (query.collectionId) {
        collectionFilters.push({
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
        collectionFilters.push({
          collections:
            query.recommended === 'true'
              ? { some: { collection: { systemType: 'RECOMMENDED' } } }
              : { none: { collection: { systemType: 'RECOMMENDED' } } },
        });
      }
      if (query.favorite !== undefined) {
        collectionFilters.push({
          collections:
            query.favorite === 'true'
              ? {
                  some: {
                    collection: {
                      ownerId: request.currentUser.id,
                      systemType: 'FAVORITES',
                    },
                  },
                }
              : {
                  none: {
                    collection: {
                      ownerId: request.currentUser.id,
                      systemType: 'FAVORITES',
                    },
                  },
                },
        });
      }
      if (collectionFilters.length > 0) where.AND = collectionFilters;
      const orderBy: Prisma.RestaurantEntryOrderByWithRelationInput[] =
        query.sort === 'name-desc'
          ? [{ name: 'desc' }, { id: 'desc' }]
          : query.sort === 'created-desc'
            ? [{ createdAt: 'desc' }, { id: 'desc' }]
            : query.sort === 'created-asc'
              ? [{ createdAt: 'asc' }, { id: 'asc' }]
              : [{ name: 'asc' }, { id: 'asc' }];
      const backward = query.direction === 'backward' && Boolean(query.cursor);

      const restaurants = await prisma.restaurantEntry.findMany({
        where,
        orderBy,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
        take: backward ? -(query.limit + 1) : query.limit + 1,
        select: publicRestaurantSelect,
      });
      const page = cursorPageResult(
        restaurants,
        query.limit,
        backward,
        query.cursor,
      );
      const visibleRows = page.items;
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
      return {
        items: visibleRows.map((restaurant) => ({
          ...serializePublicRestaurant(restaurant, request.currentUser.id),
          feedbackAggregates: aggregateByRestaurant.get(restaurant.id) ?? {
            foodRating: null,
            serviceRating: null,
            feedbackCount: 0,
          },
        })),
        pageInfo: page.pageInfo,
      };
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
        select: publicRestaurantSelect,
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
        ...serializePublicRestaurant(restaurant, request.currentUser.id),
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
        cuisineType,
        isRecommended,
        isFavorite,
        ...restaurantData
      } = data;
      const defaults = await ensureDefaultCollections(request.currentUser.id);
      const selectedCollectionIds = new Set(collectionIds ?? []);
      if (isRecommended) selectedCollectionIds.add(defaults.recommended.id);
      if (isFavorite) selectedCollectionIds.add(defaults.favorites.id);
      const created = await prisma.$transaction(async (tx) => {
        const cuisineSelection = await resolveCuisineSelection(tx, {
          cuisineType,
          cuisineIds,
          primaryCuisineId,
        });
        if (!cuisineSelection) throw invalidCuisineSelection();
        const entry = await tx.restaurantEntry.create({
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
        collectionIds,
        cuisineType,
        isRecommended,
        isFavorite,
        ...restaurantData
      } = data;
      const defaults =
        collectionIds !== undefined ||
        isRecommended !== undefined ||
        isFavorite !== undefined
          ? await ensureDefaultCollections(request.currentUser.id)
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
        if (collectionIds !== undefined && defaults) {
          const selected = new Set(collectionIds);
          if (isRecommended === true) selected.add(defaults.recommended.id);
          if (isRecommended === false) selected.delete(defaults.recommended.id);
          if (isFavorite === true) selected.add(defaults.favorites.id);
          if (isFavorite === false) selected.delete(defaults.favorites.id);
          await reconcileRestaurantCollections(tx, request.currentUser, id, [
            ...selected,
          ]);
        } else if (defaults) {
          const updateMembership = async (
            collectionId: string,
            included: boolean | undefined,
          ) => {
            if (included === true) {
              await tx.collectionRestaurant.upsert({
                where: {
                  collectionId_restaurantId: { collectionId, restaurantId: id },
                },
                update: {},
                create: { collectionId, restaurantId: id },
              });
            } else if (included === false) {
              await tx.collectionRestaurant.deleteMany({
                where: { collectionId, restaurantId: id },
              });
            }
          };
          await updateMembership(defaults.recommended.id, isRecommended);
          await updateMembership(defaults.favorites.id, isFavorite);
        }
        const current = await tx.restaurantEntry.findUniqueOrThrow({
          where: { id },
          select: publicRestaurantSelect,
        });
        return serializePublicRestaurant(current, request.currentUser.id);
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
