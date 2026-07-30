import createClient from 'openapi-fetch';

import type { paths } from './api-types';

/**
 * Typed transport generated from the API's runtime OpenAPI paths.
 *
 * The session-level ApiClient remains the compatibility facade while callers
 * migrate endpoint-by-endpoint; new transport code should use this factory.
 */
export const createTransportClient = (baseUrl: string, token: string | null) =>
  createClient<paths>({
    baseUrl,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
