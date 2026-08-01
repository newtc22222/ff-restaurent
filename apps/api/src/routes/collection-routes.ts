import type { FastifyInstance } from 'fastify';

import { requireAuthenticatedUser } from '../http/auth-guards.js';
import {
  catalogQuerySchema,
  collectionSchema,
  collectionShareSchema,
  collectionUpdateSchema,
} from '../schemas/index.js';
import {
  addRestaurantToCollection,
  createCollection,
  deleteCollection,
  ensureDefaultCollections,
  getVisibleCollection,
  listCollectionRestaurants,
  listCollectionShares,
  listCollections,
  removeRestaurantFromCollection,
  shareCollection,
  unshareCollection,
  updateCollection,
} from '../services/collection-service.js';
import { publishProductEvent } from '../services/notification-service.js';

const publishCollection = (
  collection: { id: string; name: string; updatedAt: Date },
  actor: { id: string; name: string },
  logger: Parameters<typeof publishProductEvent>[1],
) => {
  void publishProductEvent(
    {
      category: 'COLLECTION_PUBLISHED',
      actorId: actor.id,
      actorName: actor.name,
      targetUrl: `/collections/${collection.id}`,
      deduplicationKey: `collection-published:${collection.id}:${collection.updatedAt.toISOString()}`,
      data: {
        actorName: actor.name,
        collectionName: collection.name,
      },
      fallbackMessage: `${actor.name} published ${collection.name}.`,
    },
    logger,
  );
};

/**
 * Collection routes: parsing and status codes. Visibility, ownership, and
 * system-collection rules live in collection-service.
 */
export const registerCollectionRoutes = (app: FastifyInstance) => {
  const auth = { preHandler: requireAuthenticatedUser };

  app.get('/collections', auth, async (request) => {
    // Every member has a FAVORITES collection; create it lazily on first list.
    await ensureDefaultCollections(request.currentUser.id);
    const query = catalogQuerySchema.parse(request.query);
    return listCollections(query, request.currentUser.id);
  });

  app.post('/collections', auth, async (request, reply) => {
    const body = collectionSchema.parse(request.body);
    const collection = await createCollection(body, request.currentUser.id);
    if (collection.isPublic) {
      publishCollection(collection, request.currentUser, request.log);
    }
    return reply.code(201).send(collection);
  });

  app.get('/collections/:id', auth, async (request) => {
    const { id } = request.params as { id: string };
    return getVisibleCollection(id, request.currentUser.id);
  });

  app.put('/collections/:id', auth, async (request) => {
    const { id } = request.params as { id: string };
    const body = collectionUpdateSchema.parse(request.body);
    const { collection, becamePublic } = await updateCollection(
      id,
      body,
      request.currentUser.id,
    );
    if (becamePublic) {
      publishCollection(collection, request.currentUser, request.log);
    }
    return collection;
  });

  app.delete('/collections/:id', auth, async (request, reply) => {
    const { id } = request.params as { id: string };
    await deleteCollection(id, request.currentUser.id);
    return reply.code(204).send();
  });

  app.get('/collections/:id/restaurants', auth, async (request) => {
    const { id } = request.params as { id: string };
    const query = catalogQuerySchema.parse(request.query);
    return listCollectionRestaurants(id, query, request.currentUser);
  });

  app.post(
    '/collections/:id/restaurants/:restaurantId',
    auth,
    async (request, reply) => {
      const { id, restaurantId } = request.params as {
        id: string;
        restaurantId: string;
      };
      await addRestaurantToCollection(id, restaurantId, request.currentUser);
      return reply.code(201).send({ added: true });
    },
  );

  app.delete(
    '/collections/:id/restaurants/:restaurantId',
    auth,
    async (request, reply) => {
      const { id, restaurantId } = request.params as {
        id: string;
        restaurantId: string;
      };
      await removeRestaurantFromCollection(
        id,
        restaurantId,
        request.currentUser,
      );
      return reply.code(204).send();
    },
  );

  app.get('/collections/:id/shares', auth, async (request) => {
    const { id } = request.params as { id: string };
    const query = catalogQuerySchema.parse(request.query);
    return listCollectionShares(id, query, request.currentUser.id);
  });

  app.post('/collections/:id/shares', auth, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { userId } = collectionShareSchema.parse(request.body);
    await shareCollection(id, userId, request.currentUser.id);
    return reply.code(201).send({ shared: true });
  });

  app.delete(
    '/collections/:id/shares/:userId',
    auth,
    async (request, reply) => {
      const { id, userId } = request.params as { id: string; userId: string };
      await unshareCollection(id, userId, request.currentUser.id);
      return reply.code(204).send();
    },
  );
};
