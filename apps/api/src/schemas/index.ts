/**
 * Stable barrel for request-validation schemas.
 *
 * Route modules import from here rather than reaching into individual domain
 * files, so schemas can be reorganised without touching every route. When
 * FF-31 attaches these to Fastify's schema option for OpenAPI generation, this
 * is the surface it will consume.
 */

export * from './auth.js';
export * from './bill.js';
export * from './catalog.js';
export * from './collection.js';
export * from './common.js';
export * from './feedback.js';
export * from './member.js';
export * from './notification.js';
export * from './participant-group.js';
export * from './restaurant.js';
export * from './stats.js';
