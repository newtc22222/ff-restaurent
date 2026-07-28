import type { FastifyInstance } from 'fastify';
import {
  requireAuthenticatedUser,
  requireSousChefOrHeadChef,
} from '../http/auth-guards.js';
import {
  catalogQuerySchema,
  cuisineSchema,
  cuisineUpdateSchema,
  diningAreaSchema,
  diningAreaUpdateSchema,
  normalizeVietnamAddressSnapshot,
} from '../schemas/index.js';
import {
  createCuisine,
  createDiningArea,
  deleteCuisine,
  deleteDiningArea,
  listCuisines,
  listDiningAreas,
  updateCuisine,
  updateDiningArea,
} from '../services/catalog-service.js';

/** Catalog routes: parsing and status codes; persistence in catalog-service. */
export const registerCatalogRoutes = (app: FastifyInstance) => {
  const manage = {
    preHandler: [requireAuthenticatedUser, requireSousChefOrHeadChef],
  };

  app.get(
    '/cuisines',
    { preHandler: requireAuthenticatedUser },
    async (request) => listCuisines(catalogQuerySchema.parse(request.query)),
  );

  app.post('/cuisines', manage, async (request, reply) => {
    const body = cuisineSchema.parse(request.body);
    return reply.code(201).send(await createCuisine(body));
  });

  app.put('/cuisines/:id', manage, async (request) => {
    const { id } = request.params as { id: string };
    return updateCuisine(id, cuisineUpdateSchema.parse(request.body));
  });

  app.delete('/cuisines/:id', manage, async (request, reply) => {
    const { id } = request.params as { id: string };
    await deleteCuisine(id);
    return reply.code(204).send();
  });

  app.get(
    '/dining-areas',
    { preHandler: requireAuthenticatedUser },
    async (request) => listDiningAreas(catalogQuerySchema.parse(request.query)),
  );

  app.post('/dining-areas', manage, async (request, reply) => {
    const body = normalizeVietnamAddressSnapshot(
      diningAreaSchema.parse(request.body),
    );
    return reply.code(201).send(await createDiningArea(body));
  });

  app.put('/dining-areas/:id', manage, async (request) => {
    const { id } = request.params as { id: string };
    const body = normalizeVietnamAddressSnapshot(
      diningAreaUpdateSchema.parse(request.body),
    );
    return updateDiningArea(id, body);
  });

  app.delete('/dining-areas/:id', manage, async (request, reply) => {
    const { id } = request.params as { id: string };
    await deleteDiningArea(id);
    return reply.code(204).send();
  });
};
