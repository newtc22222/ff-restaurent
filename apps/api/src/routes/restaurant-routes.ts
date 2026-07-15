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
  restaurantSchema,
  restaurantUpdateSchema,
} from '../schemas.js';

type RestaurantListQuery = {
  includeArchived?: string;
  search?: string;
  sortBy?: string;
  filterCuisine?: string;
  filterFavorite?: string;
  filterRecommended?: string;
};

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
      const query = request.query as RestaurantListQuery;
      const includeArchived =
        query.includeArchived === 'true' && isHeadChef(request.currentUser);
      const where: Prisma.RestaurantEntryWhereInput = {
        status: includeArchived ? undefined : EntryStatus.ACTIVE,
        name: query.search
          ? { contains: query.search, mode: 'insensitive' }
          : undefined,
        cuisineType: query.filterCuisine
          ? { contains: query.filterCuisine, mode: 'insensitive' }
          : undefined,
        isRecommended: query.filterRecommended === 'true' ? true : undefined,
      };
      if (query.filterFavorite === 'true') {
        where.favorites = { some: { userId: request.currentUser.id } };
      }
      const orderBy: Prisma.RestaurantEntryOrderByWithRelationInput[] =
        query.sortBy === 'name'
          ? [{ name: 'asc' }]
          : [
              { isFavorite: 'desc' },
              { isRecommended: 'desc' },
              { name: 'asc' },
            ];

      const restaurants = await prisma.restaurantEntry.findMany({
        where,
        orderBy,
        select: {
          ...publicRestaurantSelect,
          favorites: {
            where: { userId: request.currentUser.id },
            select: { userId: true },
          },
        },
      });
      return restaurants.map((restaurant) => ({
        ...restaurant,
        isFavoritedByMe: restaurant.favorites.length > 0,
        favorites: undefined,
      }));
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
      return prisma.$transaction(async (tx) => {
        const cuisineSelection = await resolveCuisineSelection(tx, {
          cuisineType: restaurantData.cuisineType,
          cuisineIds,
          primaryCuisineId,
        });
        return tx.restaurantEntry.update({
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
      const existing = await prisma.userFavorite.findUnique({
        where: {
          userId_restaurantId: {
            userId: request.currentUser.id,
            restaurantId: id,
          },
        },
      });
      if (existing) {
        await prisma.userFavorite.delete({
          where: {
            userId_restaurantId: {
              userId: request.currentUser.id,
              restaurantId: id,
            },
          },
        });
        return { favorited: false };
      }
      await prisma.userFavorite.create({
        data: { userId: request.currentUser.id, restaurantId: id },
      });
      return { favorited: true };
    },
  );

  app.patch(
    '/restaurants/:id/recommend',
    { preHandler: [requireAuthenticatedUser, requireSousChefOrHeadChef] },
    async (request) => {
      const { id } = request.params as { id: string };
      const entry = await prisma.restaurantEntry.findUniqueOrThrow({
        where: { id },
      });
      return prisma.restaurantEntry.update({
        where: { id },
        data: { isRecommended: !entry.isRecommended },
        select: publicRestaurantSelect,
      });
    },
  );
};
