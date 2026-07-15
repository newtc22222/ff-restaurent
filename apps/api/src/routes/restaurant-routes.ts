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
        include: {
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
      return reply.code(201).send(
        await prisma.restaurantEntry.create({
          data: {
            ...data,
            links: data.links ?? [],
            createdById: request.currentUser.id,
          },
        }),
      );
    },
  );

  app.put(
    '/restaurants/:id',
    { preHandler: [requireAuthenticatedUser, requireSousChefOrHeadChef] },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = restaurantUpdateSchema.parse(request.body);
      const data = normalizeVietnamAddressSnapshot(body);
      return prisma.restaurantEntry.update({
        where: { id },
        data: { ...data, links: data.links ?? undefined },
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
      });
    },
  );
};
