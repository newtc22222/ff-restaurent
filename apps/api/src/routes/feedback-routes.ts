import type { FastifyInstance } from 'fastify';

import { requireAuthenticatedUser } from '../http/auth-guards.js';
import { feedbackQuerySchema, feedbackSchema } from '../schemas/index.js';
import {
  createBillFeedback,
  deleteFeedback,
  listRestaurantFeedback,
  updateFeedback,
} from '../services/feedback-service.js';

/**
 * Feedback routes: authentication, request parsing, and status codes only.
 * Eligibility rules and persistence live in feedback-service.
 */
export const registerFeedbackRoutes = (app: FastifyInstance) => {
  app.get(
    '/restaurants/:id/feedback',
    { preHandler: requireAuthenticatedUser },
    async (request) => {
      const { id: restaurantId } = request.params as { id: string };
      const query = feedbackQuerySchema.parse(request.query);
      return listRestaurantFeedback(restaurantId, query, request.currentUser);
    },
  );

  app.post(
    '/bills/:billId/feedback',
    { preHandler: requireAuthenticatedUser },
    async (request, reply) => {
      const { billId } = request.params as { billId: string };
      const body = feedbackSchema.parse(request.body);
      const created = await createBillFeedback(
        billId,
        body,
        request.currentUser,
      );
      return reply.code(201).send(created);
    },
  );

  app.put(
    '/feedback/:id',
    { preHandler: requireAuthenticatedUser },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = feedbackSchema.parse(request.body);
      return updateFeedback(id, body, request.currentUser);
    },
  );

  app.delete(
    '/feedback/:id',
    { preHandler: requireAuthenticatedUser },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await deleteFeedback(id, request.currentUser);
      return reply.code(204).send();
    },
  );
};
