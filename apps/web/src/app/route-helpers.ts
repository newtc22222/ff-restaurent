import { redirect } from 'react-router';

import { ApiError } from '@/api/client';
import { session } from '@/lib/session';

/**
 * Cross-cutting helpers shared by the route tree and by feature route modules.
 *
 * These live outside router.ts so feature slices can own their own loaders and
 * actions without importing the router — which would create a cycle, since the
 * router imports the features.
 */

/**
 * Copies through only the query parameters a list endpoint accepts, dropping
 * empty values. Prevents unrelated UI state in the URL from reaching the API.
 */
export const forwardListQuery = (request: Request, allowed: Set<string>) => {
  const source = new URL(request.url).searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of source) {
    if (allowed.has(key) && value) query.append(key, value);
  }
  return query;
};

/** Redirects to login when no session token is present. */
export const requireToken = () => {
  if (!session.getToken()) throw redirect('/login');
};

/**
 * Shared 401 handling: a rejected token means the session is gone, so clear it
 * and send the user to login rather than surfacing an error boundary.
 */
export const rethrowRouteError = (error: unknown): never => {
  if (error instanceof ApiError && error.status === 401) {
    session.clear();
    throw redirect('/login');
  }
  throw error;
};
