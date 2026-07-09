import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, { FastifyInstance } from 'fastify';
import { registerAuthRoutes } from './routes/auth-routes.js';
import { registerBillRoutes } from './routes/bill-routes.js';
import { registerMemberRoutes } from './routes/member-routes.js';
import { registerNotificationRoutes } from './routes/notification-routes.js';
import { registerProfileRoutes } from './routes/profile-routes.js';
import { registerRestaurantRoutes } from './routes/restaurant-routes.js';
import { registerStatsRoutes } from './routes/stats-routes.js';

const registerCorePlugins = async (app: FastifyInstance) => {
  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
  await app.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'dev-only-change-me',
  });
  await app.register(swagger, {
    openapi: {
      info: { title: 'FF RESTaurent API', version: '0.1.0' },
      components: {
        securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } },
      },
    },
  });
  await app.register(swaggerUi, { routePrefix: '/api/docs' });
};

const registerRoutes = (app: FastifyInstance) => {
  app.get('/health', async () => ({ ok: true }));

  registerAuthRoutes(app);
  registerProfileRoutes(app);
  registerMemberRoutes(app);
  registerRestaurantRoutes(app);
  registerBillRoutes(app);
  registerNotificationRoutes(app);
  registerStatsRoutes(app);
};

/**
 * Builds the API server with plugins first, then small route modules.
 * Keeping this file as composition-only makes the app wiring easy to scan.
 */
export const buildApp = async (): Promise<FastifyInstance> => {
  const app = Fastify({ logger: true });

  await registerCorePlugins(app);
  registerRoutes(app);

  return app;
};
