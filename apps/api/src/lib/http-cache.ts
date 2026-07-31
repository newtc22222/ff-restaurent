import { createHash } from 'node:crypto';

import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * FF-65: stable catalog reads (Cuisine, Dining Area) only. Measured Cloud Run
 * traffic showed ~24 catalog GETs / 30d (~1.7% of API GET volume), so the
 * win here is the transferred payload on a repeat read, not the DB/Cloud Run
 * hit itself. `no-cache` means the browser must always revalidate with the
 * origin before reusing a cached response — no browser-side freshness
 * window — so a mutation-invalidated app refetch is guaranteed a fresh
 * network round trip instead of silently being served a stale entry still
 * inside a `max-age` window. No shared/CDN or process-local cache is used,
 * so this stays correct across Cloud Run's multiple instances.
 */
export const computeEtag = (payload: unknown): string =>
  `"${createHash('sha1').update(JSON.stringify(payload)).digest('hex')}"`;

/**
 * Applies an ETag and a private, always-revalidated `Cache-Control` to a
 * stable catalog response. If the request's `If-None-Match` matches, sends
 * 304 with no body and returns `true` — the caller must not also send
 * `payload`.
 */
export const applyCatalogCache = (
  request: FastifyRequest,
  reply: FastifyReply,
  payload: unknown,
): boolean => {
  const etag = computeEtag(payload);
  reply.header('ETag', etag);
  reply.header('Cache-Control', 'private, no-cache');
  if (request.headers['if-none-match'] === etag) {
    reply.code(304);
    return true;
  }
  return false;
};
