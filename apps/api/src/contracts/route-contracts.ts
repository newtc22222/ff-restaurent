import type { FastifyInstance, FastifySchema, RouteOptions } from 'fastify';
import { type ZodTypeAny, z } from 'zod';

import {
  authSessionResponseSchema,
  billListQuerySchema,
  billResponseSchema,
  billSchema,
  catalogQuerySchema,
  chefRoleSchema,
  collectionResponseSchema,
  collectionSchema,
  collectionShareSchema,
  collectionUpdateSchema,
  cuisineSchema,
  cuisineUpdateSchema,
  diningAreaSchema,
  diningAreaUpdateSchema,
  errorResponseSchema,
  feedbackQuerySchema,
  feedbackSchema,
  loginSchema,
  memberQuerySchema,
  notificationPreferenceSchema,
  participantGroupSchema,
  passwordChangeSchema,
  passwordResetConsumeSchema,
  paymentStatusSchema,
  profileUpdateSchema,
  registerSchema,
  restaurantCollectionsSchema,
  restaurantEntryResponseSchema,
  restaurantListQuerySchema,
  restaurantSchema,
  restaurantUpdateSchema,
  rootAdminTransferSchema,
  sponsorshipSchema,
  statsQuerySchema,
  userAccountStatusSchema,
  userResponseSchema,
} from '../schemas/index.js';

type RequestContract = {
  body?: ZodTypeAny;
  querystring?: ZodTypeAny;
  consumes?: string[];
};

const requestContracts: Record<string, RequestContract> = {
  'POST /auth/login': { body: loginSchema },
  'POST /auth/register': { body: registerSchema },
  // This endpoint intentionally accepts malformed bodies with the same opaque
  // 202 response, so runtime validation must not short-circuit its safeParse.
  'POST /auth/password-reset-requests': { body: z.unknown() },
  'POST /auth/password-reset': { body: passwordResetConsumeSchema },
  'GET /cuisines': { querystring: catalogQuerySchema },
  'POST /cuisines': { body: cuisineSchema },
  'PUT /cuisines/:id': { body: cuisineUpdateSchema },
  'GET /dining-areas': { querystring: catalogQuerySchema },
  'GET /dining-areas/:id': {},
  'POST /dining-areas': { body: diningAreaSchema },
  'PUT /dining-areas/:id': { body: diningAreaUpdateSchema },
  'GET /collections': { querystring: catalogQuerySchema },
  'POST /collections': { body: collectionSchema },
  'PUT /collections/:id': { body: collectionUpdateSchema },
  'GET /collections/:id/restaurants': { querystring: catalogQuerySchema },
  'GET /collections/:id/shares': { querystring: catalogQuerySchema },
  'POST /collections/:id/shares': { body: collectionShareSchema },
  'GET /restaurants/:id/feedback': { querystring: feedbackQuerySchema },
  'POST /bills/:billId/feedback': { body: feedbackSchema },
  'PUT /feedback/:id': { body: feedbackSchema },
  'POST /participant-groups': { body: participantGroupSchema },
  'PUT /participant-groups/:id': { body: participantGroupSchema },
  'PUT /me/profile': { body: profileUpdateSchema },
  'PATCH /me/password': { body: passwordChangeSchema },
  'GET /members': { querystring: memberQuerySchema },
  'GET /users': { querystring: memberQuerySchema },
  'PATCH /users/:id/chef-role': { body: chefRoleSchema },
  'PATCH /users/:id/account-status': { body: userAccountStatusSchema },
  'POST /admin/root-transfer': { body: rootAdminTransferSchema },
  'GET /restaurants': { querystring: restaurantListQuerySchema },
  'POST /restaurants': { body: restaurantSchema },
  'PUT /restaurants/:id': { body: restaurantUpdateSchema },
  'PUT /restaurants/:id/collections': { body: restaurantCollectionsSchema },
  'GET /bills': { querystring: billListQuerySchema },
  'POST /bills': { body: billSchema },
  'PUT /bills/:id': { body: billSchema },
  'PATCH /bills/:id/participants/:memberId/payment': {
    body: paymentStatusSchema,
  },
  'POST /bills/:id/sponsorships': { body: sponsorshipSchema },
  'PATCH /me/notification-preferences': {
    body: notificationPreferenceSchema,
  },
  'PUT /me/avatar': {
    body: z.unknown(),
    consumes: ['multipart/form-data'],
  },
  'PUT /restaurants/:id/logo': {
    body: z.unknown(),
    consumes: ['multipart/form-data'],
  },
  'PUT /restaurants/:id/banner': {
    body: z.unknown(),
    consumes: ['multipart/form-data'],
  },
  'POST /me/payment-qr-images': {
    body: z.unknown(),
    consumes: ['multipart/form-data'],
  },
  'PATCH /me/payment-qr-images/:id': { body: z.unknown() },
  'POST /me/payment-qr-images/:id/replacement': {
    body: z.unknown(),
    consumes: ['multipart/form-data'],
  },
  'GET /stats/me': { querystring: statsQuerySchema },
};

const pageOf = (item: ZodTypeAny) =>
  z
    .object({
      items: z.array(item),
      pageInfo: z
        .object({
          startCursor: z.string().nullable().optional(),
          endCursor: z.string().nullable(),
          hasPreviousPage: z.boolean().optional(),
          hasNextPage: z.boolean(),
        })
        .passthrough(),
    })
    .passthrough();

const successResponses: Record<string, Record<string, ZodTypeAny>> = {
  'GET /health': { '200': z.object({ ok: z.literal(true) }) },
  'GET /ready': {
    '200': z.object({ ok: z.literal(true), database: z.literal('ready') }),
    '503': z.object({
      ok: z.literal(false),
      database: z.literal('unavailable'),
    }),
  },
  'POST /auth/login': { '200': authSessionResponseSchema },
  'POST /auth/register': { '201': authSessionResponseSchema },
  'GET /me': { '200': userResponseSchema },
  'PUT /me/profile': { '200': userResponseSchema },
  'GET /members': { '200': pageOf(userResponseSchema) },
  'GET /users': { '200': pageOf(userResponseSchema) },
  'PATCH /users/:id/chef-role': { '200': userResponseSchema },
  'PATCH /users/:id/account-status': { '200': userResponseSchema },
  'GET /collections': { '200': pageOf(collectionResponseSchema) },
  'POST /collections': { '201': collectionResponseSchema },
  'GET /collections/:id': { '200': collectionResponseSchema },
  'PUT /collections/:id': { '200': collectionResponseSchema },
  'GET /restaurants': { '200': pageOf(restaurantEntryResponseSchema) },
  'GET /restaurants/:id': { '200': restaurantEntryResponseSchema },
  'POST /restaurants': { '201': restaurantEntryResponseSchema },
  'PUT /restaurants/:id': { '200': restaurantEntryResponseSchema },
  'PATCH /restaurants/:id/archive': { '200': restaurantEntryResponseSchema },
  'PATCH /restaurants/:id/restore': { '200': restaurantEntryResponseSchema },
  'PATCH /restaurants/:id/recommend': { '200': restaurantEntryResponseSchema },
  'GET /bills': { '200': pageOf(billResponseSchema) },
  'GET /bills/:id': { '200': billResponseSchema },
  'POST /bills': { '201': billResponseSchema },
  'PUT /bills/:id': { '200': billResponseSchema },
  'PATCH /bills/:id/archive': { '200': billResponseSchema },
  'PATCH /bills/:id/restore': { '200': billResponseSchema },
  'POST /bills/:id/sponsorships': { '200': billResponseSchema },
  'GET /notifications/stream': { '200': z.string() },
};

const publicRoutes = new Set([
  'GET /health',
  'GET /ready',
  'POST /auth/login',
  'POST /auth/register',
  'POST /auth/password-reset-requests',
  'POST /auth/password-reset',
]);

const paramsForUrl = (url: string): ZodTypeAny | undefined => {
  const names = [...url.matchAll(/:([A-Za-z0-9_]+)/g)].map((match) => match[1]);
  if (names.length === 0) return undefined;
  return z.object(
    Object.fromEntries(
      names.map((name) => [
        name,
        name === 'provinceCode'
          ? z
              .string()
              .regex(/^p-[a-z0-9-]{1,62}$/)
              .max(64)
          : z.string().min(1),
      ]),
    ),
  );
};

const operationId = (method: string, url: string) =>
  `${method.toLowerCase()}${url
    .split('/')
    .filter(Boolean)
    .map((part) =>
      part.startsWith(':')
        ? `By${part.slice(1, 2).toUpperCase()}${part.slice(2)}`
        : `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`,
    )
    .join('')}`;

const isApplicationRoute = (url: string) => !url.startsWith('/api/docs');

/**
 * Makes every application route part of one runtime/OpenAPI contract.
 * Unknown success bodies remain passthrough until their domain is promoted to
 * a named component; errors always retain the stable `{ message, code? }`
 * shape, including media 404s that intentionally omit `code`.
 */
export const registerRouteContracts = (app: FastifyInstance) => {
  app.addHook('onRoute', (routeOptions: RouteOptions) => {
    const url = routeOptions.url;
    if (!isApplicationRoute(url)) return;

    const method = Array.isArray(routeOptions.method)
      ? routeOptions.method[0]
      : routeOptions.method;
    const key = `${method} ${url}`;
    const request = requestContracts[key] ?? {};
    const params = paramsForUrl(url);
    const existing = routeOptions.schema ?? {};
    const responses = successResponses[key] ?? {};

    /*
     * Fastify validates schemas before preHandler. Authentication historically
     * ran before each handler's manual Zod parse, so move these route-local
     * guards to onRequest to preserve the 401-before-validation contract.
     */
    if (routeOptions.preHandler) {
      const existingOnRequest = routeOptions.onRequest
        ? Array.isArray(routeOptions.onRequest)
          ? routeOptions.onRequest
          : [routeOptions.onRequest]
        : [];
      const guards = Array.isArray(routeOptions.preHandler)
        ? routeOptions.preHandler
        : [routeOptions.preHandler];
      routeOptions.onRequest = [...existingOnRequest, ...guards];
      routeOptions.preHandler = undefined;
    }

    routeOptions.schema = {
      ...existing,
      ...request,
      ...(params ? { params } : {}),
      operationId: operationId(method, url),
      security: publicRoutes.has(key) ? [] : [{ bearerAuth: [] }],
      response: {
        '2xx': z.unknown(),
        '4xx': errorResponseSchema,
        '5xx': errorResponseSchema,
        ...responses,
      },
    } satisfies FastifySchema;
  });
};
