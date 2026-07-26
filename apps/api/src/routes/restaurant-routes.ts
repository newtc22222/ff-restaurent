import type { FastifyInstance } from 'fastify';
import { EntryStatus } from '@prisma/client';
import {
  requireAuthenticatedUser,
  requireHeadChef,
  requireSousChefOrHeadChef,
} from '../http/auth-guards.js';
import {
  normalizeVietnamAddressSnapshot,
  restaurantCollectionsSchema,
  restaurantListQuerySchema,
  restaurantSchema,
  restaurantUpdateSchema,
} from '../schemas/index.js';
import {
  toggleFavoriteShortcut,
  toggleRecommendedShortcut,
} from '../services/collection-service.js';
import {
  createRestaurant,
  getRestaurantDetail,
  listRestaurants,
  serializeAfterRecommend,
  setRestaurantCollections,
  setRestaurantStatus,
  updateRestaurant,
} from '../services/restaurant-service.js';

/**
 * Restaurant routes manage the directory, favorites, recommendations, and
 * archive state. Persistence and the cuisine contract live in
 * restaurant-service.
 */
export const registerRestaurantRoutes = (app: FastifyInstance) => {
  const chef = {
    preHandler: [requireAuthenticatedUser, requireSousChefOrHeadChef],
  };
  const headChef = { preHandler: [requireAuthenticatedUser, requireHeadChef] };

  app.get(
    '/restaurants',
    { preHandler: requireAuthenticatedUser },
    async (request) => {
      const query = restaurantListQuerySchema.parse(request.query);
      return listRestaurants(query, request.currentUser);
    },
  );

  app.get(
    '/restaurants/:id',
    { preHandler: requireAuthenticatedUser },
    async (request) => {
      const { id } = request.params as { id: string };
      return getRestaurantDetail(id, request.currentUser);
    },
  );

  app.post('/restaurants', chef, async (request, reply) => {
    const body = restaurantSchema.parse(request.body);
    const created = await createRestaurant(
      normalizeVietnamAddressSnapshot(body),
      request.currentUser,
    );
    return reply.code(201).send(created);
  });

  app.put('/restaurants/:id', chef, async (request) => {
    const { id } = request.params as { id: string };
    const body = restaurantUpdateSchema.parse(request.body);
    return updateRestaurant(
      id,
      normalizeVietnamAddressSnapshot(body),
      request.currentUser,
    );
  });

  app.put(
    '/restaurants/:id/collections',
    { preHandler: requireAuthenticatedUser },
    async (request) => {
      const { id } = request.params as { id: string };
      const { collectionIds } = restaurantCollectionsSchema.parse(request.body);
      return setRestaurantCollections(id, collectionIds, request.currentUser);
    },
  );

  app.patch('/restaurants/:id/archive', headChef, async (request) => {
    const { id } = request.params as { id: string };
    return setRestaurantStatus(id, EntryStatus.ARCHIVED, request.currentUser);
  });

  app.patch('/restaurants/:id/restore', headChef, async (request) => {
    const { id } = request.params as { id: string };
    return setRestaurantStatus(id, EntryStatus.ACTIVE, request.currentUser);
  });

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

  app.patch('/restaurants/:id/recommend', chef, async (request) => {
    const { id } = request.params as { id: string };
    const recommended = await toggleRecommendedShortcut(id);
    return serializeAfterRecommend(id, recommended, request.currentUser);
  });
};
