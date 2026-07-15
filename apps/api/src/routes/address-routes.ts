import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AddressDirectory } from '../address-directory.js';
import { loadConfig } from '../config.js';
import { requireAuthenticatedUser } from '../http/auth-guards.js';

export const registerAddressRoutes = (app: FastifyInstance) => {
  const config = loadConfig();
  const directory = new AddressDirectory({
    baseUrl: config.provincesApiUrl,
    timeoutMs: config.provincesApiTimeoutMs,
    cacheTtlMs: config.provincesCacheTtlMs,
  });

  app.get('/address/provinces', { preHandler: requireAuthenticatedUser }, () =>
    directory.getProvinces(),
  );

  app.get(
    '/address/provinces/:provinceCode/wards',
    { preHandler: requireAuthenticatedUser },
    (request) => {
      const { provinceCode } = z
        .object({ provinceCode: z.string().regex(/^\d{1,3}$/) })
        .parse(request.params);
      return directory.getWards(provinceCode);
    },
  );
};
