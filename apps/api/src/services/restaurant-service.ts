import { EntryStatus, Prisma } from '@prisma/client';
import type { z } from 'zod';
import { badRequest, notFound } from '../http/app-error.js';
import {
  buildPublicRestaurantSelect,
  serializePublicRestaurant,
} from '../contracts/restaurant-contract.js';
import {
  normalizeCatalogKey,
  normalizeDisplayText,
} from '../lib/catalog-normalization.js';
import { cursorPageResult } from '../lib/pagination.js';
import { prisma } from '../lib/prisma.js';
import { isHeadChef, type CurrentUser } from '../lib/roles.js';
import { normalizeSearchQuery } from '../lib/search-normalization.js';
import type {
  restaurantListQuerySchema,
  restaurantSchema,
  restaurantUpdateSchema,
} from '../schemas/index.js';
import {
  ensureDefaultCollections,
  getVisibleRestaurantCollections,
  reconcileRestaurantCollections,
} from './collection-service.js';

/**
 * Restaurant directory, profile writes, and archive state.
 *
 * The Phase 2 contract requires every restaurant to have exactly one primary
 * cuisine, which is why cuisine resolution runs inside the same transaction as
 * the write and refuses to proceed without a valid selection.
 */

type RestaurantListQuery = z.infer<typeof restaurantListQuerySchema>;
type RestaurantInput = z.infer<typeof restaurantSchema>;
type RestaurantUpdate = z.infer<typeof restaurantUpdateSchema>;

type RestaurantCuisineInput = {
  cuisineType?: string;
  cuisineIds?: string[];
  primaryCuisineId?: string;
};

const invalidCuisineSelection = () =>
  badRequest('CUISINE_SELECTION_INVALID', 'Selected cuisines are invalid');

/**
 * Resolves the cuisine join rows for a write.
 *
 * Two accepted forms: an explicit `cuisineIds` + `primaryCuisineId` pair, or
 * the deprecated free-text `cuisineType`, which is upserted into the catalog
 * under a `Legacy` type so old clients keep working.
 */
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
    create: { name, nameKey: normalizeCatalogKey(name), type: 'Legacy' },
    select: { id: true, name: true },
  });
  return {
    primaryName: cuisine.name,
    joins: [{ cuisineId: cuisine.id, isPrimary: true }],
  };
};

export const listRestaurants = async (
  query: RestaurantListQuery,
  user: CurrentUser,
) => {
  const requestedStatus =
    query.archive === 'archived'
      ? EntryStatus.ARCHIVED
      : query.archive === 'all'
        ? undefined
        : EntryStatus.ACTIVE;
  // Only HEAD_CHEF may look at archived entries, whatever was requested.
  const status = isHeadChef(user) ? requestedStatus : EntryStatus.ACTIVE;
  const where: Prisma.RestaurantEntryWhereInput = {
    status,
    OR: query.search
      ? [
          { searchText: { contains: normalizeSearchQuery(query.search) } },
          {
            cuisines: {
              some: {
                cuisine: {
                  searchText: { contains: normalizeSearchQuery(query.search) },
                },
              },
            },
          },
        ]
      : undefined,
    diningAreaId: query.diningAreaId,
    cuisines: query.primaryCuisineId
      ? { some: { cuisineId: query.primaryCuisineId, isPrimary: true } }
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
              { ownerId: user.id },
              { isPublic: true },
              { shares: { some: { userId: user.id } } },
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
                collection: { ownerId: user.id, systemType: 'FAVORITES' },
              },
            }
          : {
              none: {
                collection: { ownerId: user.id, systemType: 'FAVORITES' },
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
    select: buildPublicRestaurantSelect(user.id),
  });
  const page = cursorPageResult(
    restaurants,
    query.limit,
    backward,
    query.cursor,
  );
  const visibleRows = page.items;

  /*
   * Ratings are aggregated for the visible page only, in one grouped query,
   * rather than per row.
   */
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
      ...serializePublicRestaurant(restaurant, user.id),
      feedbackAggregates: aggregateByRestaurant.get(restaurant.id) ?? {
        foodRating: null,
        serviceRating: null,
        feedbackCount: 0,
      },
    })),
    pageInfo: page.pageInfo,
  };
};

export const getRestaurantDetail = async (id: string, user: CurrentUser) => {
  await ensureDefaultCollections(user.id);
  const restaurant = await prisma.restaurantEntry.findFirst({
    where: { id, status: isHeadChef(user) ? undefined : EntryStatus.ACTIVE },
    select: buildPublicRestaurantSelect(user.id),
  });
  if (!restaurant) {
    throw notFound('RESTAURANT_NOT_FOUND', 'Restaurant not found');
  }
  const collections = await getVisibleRestaurantCollections(user.id, id);
  return { ...serializePublicRestaurant(restaurant, user.id), collections };
};

export const createRestaurant = async (
  data: RestaurantInput,
  user: CurrentUser,
) => {
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
  const defaults = await ensureDefaultCollections(user.id);
  const selectedCollectionIds = new Set(collectionIds ?? []);
  if (isRecommended) selectedCollectionIds.add(defaults.recommended.id);
  if (isFavorite) selectedCollectionIds.add(defaults.favorites.id);
  const created = await prisma.$transaction(async (tx) => {
    const cuisineSelection = await resolveCuisineSelection(tx, {
      cuisineType,
      cuisineIds,
      primaryCuisineId,
    });
    // Creation always requires a cuisine; updates may leave it untouched.
    if (!cuisineSelection) throw invalidCuisineSelection();
    const entry = await tx.restaurantEntry.create({
      data: {
        ...restaurantData,
        createdById: user.id,
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
    await reconcileRestaurantCollections(tx, user, entry.id, [
      ...selectedCollectionIds,
    ]);
    return tx.restaurantEntry.findUniqueOrThrow({
      where: { id: entry.id },
      select: buildPublicRestaurantSelect(user.id),
    });
  });
  return serializePublicRestaurant(created, user.id);
};

export const updateRestaurant = async (
  id: string,
  data: RestaurantUpdate,
  user: CurrentUser,
) => {
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
      ? await ensureDefaultCollections(user.id)
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
          ? { cuisines: { deleteMany: {}, create: cuisineSelection.joins } }
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
      select: buildPublicRestaurantSelect(user.id),
    });
    if (collectionIds !== undefined && defaults) {
      // An explicit list is authoritative; the legacy flags only adjust it.
      const selected = new Set(collectionIds);
      if (isRecommended === true) selected.add(defaults.recommended.id);
      if (isRecommended === false) selected.delete(defaults.recommended.id);
      if (isFavorite === true) selected.add(defaults.favorites.id);
      if (isFavorite === false) selected.delete(defaults.favorites.id);
      await reconcileRestaurantCollections(tx, user, id, [...selected]);
    } else if (defaults) {
      // No list supplied: the legacy flags toggle membership in isolation.
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
      select: buildPublicRestaurantSelect(user.id),
    });
    return serializePublicRestaurant(current, user.id);
  });
};

export const setRestaurantCollections = async (
  id: string,
  collectionIds: string[],
  user: CurrentUser,
) => {
  await ensureDefaultCollections(user.id);
  return prisma.$transaction(async (tx) => {
    await tx.restaurantEntry.findUniqueOrThrow({
      where: { id },
      select: { id: true },
    });
    await reconcileRestaurantCollections(tx, user, id, collectionIds);
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
};

export const setRestaurantStatus = async (
  id: string,
  status: EntryStatus,
  user: CurrentUser,
) => {
  const restaurant = await prisma.restaurantEntry.update({
    where: { id },
    data: { status },
    select: buildPublicRestaurantSelect(user.id),
  });
  return serializePublicRestaurant(restaurant, user.id);
};

/** Re-reads the entry so the response reflects the toggled membership. */
export const serializeAfterRecommend = async (
  id: string,
  recommended: boolean,
  user: CurrentUser,
) => {
  const entry = await prisma.restaurantEntry.findUniqueOrThrow({
    where: { id },
    select: buildPublicRestaurantSelect(user.id),
  });
  return {
    ...serializePublicRestaurant(entry, user.id),
    isRecommended: recommended,
  };
};
