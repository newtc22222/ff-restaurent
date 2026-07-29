import { CollectionSystemType, EntryStatus, Prisma } from '@prisma/client';
import type { z } from 'zod';

import {
  buildPublicRestaurantSelect,
  serializePublicRestaurant,
} from '../contracts/restaurant-contract.js';
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
} from '../http/app-error.js';
import { pageResult } from '../lib/pagination.js';
import { prisma } from '../lib/prisma.js';
import {
  type CurrentUser,
  isHeadChef,
  isSousChefOrAbove,
} from '../lib/roles.js';
import { normalizeSearchQuery } from '../lib/search-normalization.js';
import type { catalogQuerySchema } from '../schemas/index.js';

export const restaurantCollectionSelect = {
  id: true,
  name: true,
  description: true,
  isPublic: true,
  systemType: true,
  ownerId: true,
} satisfies Prisma.CollectionSelect;

const visibleCollectionWhere = (
  userId: string,
): Prisma.CollectionWhereInput => ({
  OR: [
    { ownerId: userId },
    { isPublic: true },
    { shares: { some: { userId } } },
  ],
});

const manageableCollectionWhere = (
  user: CurrentUser,
): Prisma.CollectionWhereInput => ({
  OR: [
    { ownerId: user.id },
    ...(isSousChefOrAbove(user)
      ? [{ systemType: CollectionSystemType.RECOMMENDED }]
      : []),
  ],
});

export const getVisibleRestaurantCollections = (
  userId: string,
  restaurantId: string,
) =>
  prisma.collection.findMany({
    where: {
      AND: [
        visibleCollectionWhere(userId),
        { restaurants: { some: { restaurantId } } },
      ],
    },
    orderBy: [{ systemType: 'desc' }, { name: 'asc' }, { id: 'asc' }],
    select: restaurantCollectionSelect,
  });

export const reconcileRestaurantCollections = async (
  tx: Prisma.TransactionClient,
  user: CurrentUser,
  restaurantId: string,
  collectionIds: string[],
) => {
  const manageable = await tx.collection.findMany({
    where: manageableCollectionWhere(user),
    select: { id: true, ownerId: true, systemType: true },
  });
  const manageableIds = new Set(manageable.map(({ id }) => id));
  const unmanageable = collectionIds.find((id) => !manageableIds.has(id));
  if (unmanageable) {
    throw forbidden(
      'COLLECTION_MANAGER_REQUIRED',
      'A selected collection cannot be managed by this user',
    );
  }

  await tx.collectionRestaurant.deleteMany({
    where: {
      restaurantId,
      collectionId: {
        in: manageable.map(({ id }) => id),
        notIn: collectionIds,
      },
    },
  });
  if (collectionIds.length > 0) {
    await tx.collectionRestaurant.createMany({
      data: collectionIds.map((collectionId) => ({
        collectionId,
        restaurantId,
      })),
      skipDuplicates: true,
    });
  }
};

const findFavorites = (userId: string) =>
  prisma.collection.findFirst({
    where: { ownerId: userId, systemType: CollectionSystemType.FAVORITES },
  });

export const ensureFavoritesCollection = async (userId: string) => {
  let collection = await findFavorites(userId);
  if (!collection) {
    try {
      collection = await prisma.collection.create({
        data: {
          name: 'Favorites',
          isPublic: false,
          systemType: CollectionSystemType.FAVORITES,
          ownerId: userId,
        },
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      ) {
        throw error;
      }
      collection = await findFavorites(userId);
    }
  }
  if (!collection) throw new Error('Favorites collection could not be created');

  return collection;
};

const findRecommended = () =>
  prisma.collection.findFirst({
    where: { systemType: CollectionSystemType.RECOMMENDED },
  });

export const ensureRecommendedCollection = async () => {
  let collection = await findRecommended();
  if (!collection) {
    try {
      collection = await prisma.collection.create({
        data: {
          name: 'Recommended',
          isPublic: true,
          systemType: CollectionSystemType.RECOMMENDED,
        },
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      ) {
        throw error;
      }
      collection = await findRecommended();
    }
  }
  if (!collection)
    throw new Error('Recommended collection could not be created');

  return collection;
};

export const ensureDefaultCollections = async (userId: string) => {
  const [favorites, recommended] = await Promise.all([
    ensureFavoritesCollection(userId),
    ensureRecommendedCollection(),
  ]);
  return { favorites, recommended };
};

export const toggleFavoriteShortcut = async (
  userId: string,
  restaurantId: string,
) => {
  const collection = await ensureFavoritesCollection(userId);
  return prisma.$transaction(async (tx) => {
    await tx.restaurantEntry.findUniqueOrThrow({
      where: { id: restaurantId },
      select: { id: true },
    });
    const membership = await tx.collectionRestaurant.findUnique({
      where: {
        collectionId_restaurantId: {
          collectionId: collection.id,
          restaurantId,
        },
      },
      select: { collectionId: true },
    });
    if (membership) {
      await tx.collectionRestaurant.delete({
        where: {
          collectionId_restaurantId: {
            collectionId: collection.id,
            restaurantId,
          },
        },
      });
      return false;
    }
    await tx.collectionRestaurant.create({
      data: { collectionId: collection.id, restaurantId },
    });
    return true;
  });
};

export const toggleRecommendedShortcut = async (restaurantId: string) => {
  const collection = await ensureRecommendedCollection();
  return prisma.$transaction(async (tx) => {
    await tx.restaurantEntry.findUniqueOrThrow({
      where: { id: restaurantId },
      select: { id: true },
    });
    const membership = await tx.collectionRestaurant.findUnique({
      where: {
        collectionId_restaurantId: {
          collectionId: collection.id,
          restaurantId,
        },
      },
      select: { collectionId: true },
    });
    const recommended = !membership;
    if (recommended) {
      await tx.collectionRestaurant.upsert({
        where: {
          collectionId_restaurantId: {
            collectionId: collection.id,
            restaurantId,
          },
        },
        update: {},
        create: { collectionId: collection.id, restaurantId },
      });
    } else {
      await tx.collectionRestaurant.deleteMany({
        where: { collectionId: collection.id, restaurantId },
      });
    }
    return recommended;
  });
};

/*
 * ---------------------------------------------------------------------------
 * Collection CRUD, membership, and sharing.
 *
 * Visibility has three sources — ownership, the public flag, and an explicit
 * share — and every read path filters on all three. Writes additionally
 * distinguish system collections (FAVORITES / RECOMMENDED), whose metadata is
 * immutable and whose membership is chef-managed rather than owner-managed.
 * ---------------------------------------------------------------------------
 */

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

const COLLECTION_MISSING = () =>
  notFound('COLLECTION_NOT_FOUND', 'Collection not found');

export const getVisibleCollection = async (id: string, userId: string) => {
  const collection = await prisma.collection.findFirst({
    where: { id, ...visibleWhere(userId) },
    select: collectionSelect,
  });
  if (!collection) throw COLLECTION_MISSING();
  return collection;
};

const getCollection = async (id: string) => {
  const collection = await prisma.collection.findUnique({ where: { id } });
  if (!collection) throw COLLECTION_MISSING();
  return collection;
};

/** Metadata edits and sharing are owner-only, and never apply to system collections. */
export const requireCustomOwner = async (id: string, userId: string) => {
  const collection = await getCollection(id);
  if (collection.systemType) {
    throw conflict(
      'SYSTEM_COLLECTION_IMMUTABLE',
      'System collection metadata cannot be changed',
    );
  }
  if (collection.ownerId !== userId) {
    throw forbidden('COLLECTION_OWNER_REQUIRED', 'Collection owner required');
  }
  return collection;
};

/**
 * Membership on the global RECOMMENDED collection is a chef responsibility;
 * every other collection is managed by its owner.
 */
export const requireMembershipManager = async (
  id: string,
  user: CurrentUser,
) => {
  const collection = await getCollection(id);
  if (collection.systemType === CollectionSystemType.RECOMMENDED) {
    if (!isSousChefOrAbove(user)) {
      throw forbidden('CHEF_REQUIRED', 'A chef must manage Recommended');
    }
    return collection;
  }
  if (collection.ownerId !== user.id) {
    throw forbidden('COLLECTION_OWNER_REQUIRED', 'Collection owner required');
  }
  return collection;
};

type CollectionQuery = z.infer<typeof catalogQuerySchema>;

export const listCollections = async (
  query: CollectionQuery,
  userId: string,
) => {
  const visibilityFilter: Prisma.CollectionWhereInput =
    query.visibility === 'owned'
      ? { ownerId: userId }
      : query.visibility === 'public'
        ? { isPublic: true }
        : query.visibility === 'shared'
          ? { shares: { some: { userId } } }
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
        visibleWhere(userId),
        visibilityFilter,
        query.systemType === 'custom'
          ? { systemType: null }
          : query.systemType
            ? { systemType: query.systemType }
            : {},
        ...(query.search
          ? [{ searchText: { contains: normalizeSearchQuery(query.search) } }]
          : []),
      ],
    },
    orderBy,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    take: query.limit + 1,
    select: collectionSelect,
  });
  return pageResult(items, query.limit);
};

export type CollectionInput = {
  name: string;
  description?: string | null;
  isPublic: boolean;
};

export const createCollection = (body: CollectionInput, ownerId: string) =>
  prisma.collection.create({
    data: {
      name: body.name,
      description: body.description || null,
      isPublic: body.isPublic,
      ownerId,
    },
    select: collectionSelect,
  });

export const updateCollection = async (
  id: string,
  body: Partial<CollectionInput>,
  userId: string,
) => {
  await requireCustomOwner(id, userId);
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
};

export const deleteCollection = async (id: string, userId: string) => {
  await requireCustomOwner(id, userId);
  await prisma.collection.delete({ where: { id } });
};

export const listCollectionRestaurants = async (
  id: string,
  query: CollectionQuery,
  user: CurrentUser,
) => {
  await getVisibleCollection(id, user.id);
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
        // Archived restaurants stay visible to HEAD_CHEF only.
        status: isHeadChef(user) ? undefined : EntryStatus.ACTIVE,
        OR: query.search
          ? [
              { searchText: { contains: normalizeSearchQuery(query.search) } },
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
      restaurant: { select: buildPublicRestaurantSelect(user.id) },
    },
  });
  const hasNextPage = items.length > query.limit;
  const page = items.slice(0, query.limit);
  return {
    items: page.map(({ restaurant, createdAt }) => ({
      ...serializePublicRestaurant(restaurant, user.id),
      addedAt: createdAt,
    })),
    pageInfo: {
      endCursor: hasNextPage ? (page.at(-1)?.restaurantId ?? null) : null,
      hasNextPage,
    },
  };
};

export const addRestaurantToCollection = async (
  id: string,
  restaurantId: string,
  user: CurrentUser,
) => {
  await requireMembershipManager(id, user);
  await prisma.$transaction(async (tx) => {
    // Throws P2025, mapped to 404, when the restaurant does not exist.
    await tx.restaurantEntry.findUniqueOrThrow({
      where: { id: restaurantId },
      select: { id: true },
    });
    await tx.collectionRestaurant.upsert({
      where: { collectionId_restaurantId: { collectionId: id, restaurantId } },
      update: {},
      create: { collectionId: id, restaurantId },
    });
  });
};

export const removeRestaurantFromCollection = async (
  id: string,
  restaurantId: string,
  user: CurrentUser,
) => {
  await requireMembershipManager(id, user);
  await prisma.$transaction(async (tx) => {
    await tx.collectionRestaurant.deleteMany({
      where: { collectionId: id, restaurantId },
    });
  });
};

export const listCollectionShares = async (
  id: string,
  query: CollectionQuery,
  userId: string,
) => {
  await requireCustomOwner(id, userId);
  const items = await prisma.collectionShare.findMany({
    where: {
      collectionId: id,
      user: query.search
        ? { searchText: { contains: normalizeSearchQuery(query.search) } }
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
};

export const shareCollection = async (
  id: string,
  targetUserId: string,
  ownerId: string,
) => {
  await requireCustomOwner(id, ownerId);
  if (targetUserId === ownerId) {
    throw badRequest(
      'COLLECTION_OWNER_SHARE_INVALID',
      'An owner cannot share a collection with themselves',
    );
  }
  await prisma.collectionShare.upsert({
    where: { collectionId_userId: { collectionId: id, userId: targetUserId } },
    update: {},
    create: { collectionId: id, userId: targetUserId },
  });
};

export const unshareCollection = async (
  id: string,
  targetUserId: string,
  ownerId: string,
) => {
  await requireCustomOwner(id, ownerId);
  await prisma.collectionShare.deleteMany({
    where: { collectionId: id, userId: targetUserId },
  });
};
