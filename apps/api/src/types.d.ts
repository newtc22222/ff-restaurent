import 'fastify';
import { CurrentUser } from './roles.js';

declare module 'fastify' {
  interface FastifyRequest {
    currentUser: CurrentUser;
  }
}
