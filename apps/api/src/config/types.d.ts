import type { PrismaClient } from '@prisma/client';

import 'fastify';

import { CurrentUser } from '../lib/roles.js';
import type { AppConfig } from './config.js';

declare module 'fastify' {
  interface FastifyRequest {
    currentUser: CurrentUser;
  }

  /**
   * Shared dependencies decorated onto the instance in `app.ts`.
   *
   * These give route and plugin code one typed lifecycle to reach for rather
   * than importing the singletons directly, which is what makes an alternative
   * instance — a test app, a script — possible later.
   */
  interface FastifyInstance {
    config: AppConfig;
    prisma: PrismaClient;
  }
}
