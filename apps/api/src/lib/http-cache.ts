import { createHash } from 'node:crypto';

import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * FF-65: stable catalog reads (Cuisine, Dining Area) only. Measured Cloud Run
 * traffic showed ~24 catalog GETs / 30d (~1.7% of API GET volume) and zero
 * catalog mutations in 90d, so a short private validator window is enough to
 * cut repeat reads without risking staleness — no shared/CDN or
 * process-local cache is used, so this stays correct across Cloud Run's
 * multiple instances.
 */
const CATALOG_MAX_AGE_SECONDS = 30;

export const computeEtag = (payload: unknown): string =>
  `"${createHash('sha1').update(JSON.stringify(payload)).digest('hex')}"`;

/**
 * Applies an ETag and a private, short-lived `Cache-Control` to a stable
 * catalog response. If the request's `If-None-Match` matches, sends 304 with
 * no body and returns `true` — the caller must not also send `payload`.
 */
export const applyCatalogCache = (
  request: FastifyRequest,
  reply: FastifyReply,
  payload: unknown,
  maxAgeSeconds: number = CATALOG_MAX_AGE_SECONDS,
): boolean => {
  const etag = computeEtag(payload);
  reply.header('ETag', etag);
  reply.header(
    'Cache-Control',
    `private, max-age=${maxAgeSeconds}, must-revalidate`,
  );
  if (request.headers['if-none-match'] === etag) {
    reply.code(304);
    return true;
  }
  return false;
};
