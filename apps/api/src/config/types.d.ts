import 'fastify';
import { CurrentUser } from '../lib/roles.js';

declare module 'fastify' {
  interface FastifyRequest {
    currentUser: CurrentUser;
  }
}
