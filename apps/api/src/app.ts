import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, { FastifyInstance } from 'fastify';
import { loadConfig } from './config.js';
import { registerErrorHandler } from './http/error-handler.js';
import { prisma } from './prisma.js';
import { registerAuthRoutes } from './routes/auth-routes.js';
import { registerAddressRoutes } from './routes/address-routes.js';
import { registerBillRoutes } from './routes/bill-routes.js';
import { registerCatalogRoutes } from './routes/catalog-routes.js';
import { registerCollectionRoutes } from './routes/collection-routes.js';
import { registerFeedbackRoutes } from './routes/feedback-routes.js';
import { registerMemberRoutes } from './routes/member-routes.js';
import { registerMediaRoutes } from './routes/media-routes.js';
import { registerNotificationRoutes } from './routes/notification-routes.js';
import { registerPasswordResetRoutes } from './routes/password-reset-routes.js';
import { registerParticipantGroupRoutes } from './routes/participant-group-routes.js';
import { registerProfileRoutes } from './routes/profile-routes.js';
import { registerRestaurantRoutes } from './routes/restaurant-routes.js';
import { registerStatsRoutes } from './routes/stats-routes.js';

const registerCorePlugins = async (app: FastifyInstance) => {
  const config = loadConfig();
  await app.register(cors, {
    origin: config.corsOrigins.length > 0 ? config.corsOrigins : true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
  await app.register(jwt, {
    secret: config.jwtSecret,
    sign: { expiresIn: config.jwtExpiresIn },
  });
  await app.register(multipart, {
    limits: { files: 1, fields: 2, fileSize: 5 * 1024 * 1024 },
  });
  if (config.isProduction) {
    await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
  }
  await app.register(swagger, {
    openapi: {
      info: { title: 'FF RESTaurent API', version: '1.1.0' },
      components: {
        securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } },
      },
    },
  });
  await app.register(swaggerUi, { routePrefix: '/api/docs' });
};

const registerRoutes = (app: FastifyInstance) => {
  app.get('/health', async () => ({ ok: true }));
  app.get('/ready', async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { ok: true, database: 'ready' };
    } catch {
      return reply.code(503).send({ ok: false, database: 'unavailable' });
    }
  });

  registerAuthRoutes(app);
  registerAddressRoutes(app);
  registerCatalogRoutes(app);
  registerCollectionRoutes(app);
  registerFeedbackRoutes(app);
  registerPasswordResetRoutes(app);
  registerParticipantGroupRoutes(app);
  registerProfileRoutes(app);
  registerMemberRoutes(app);
  registerMediaRoutes(app);
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
  registerErrorHandler(app);
  registerRoutes(app);

  return app;
};
