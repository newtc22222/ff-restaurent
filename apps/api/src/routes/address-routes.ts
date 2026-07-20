import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import { z } from 'zod';
import { AddressDirectory } from '../address-directory.js';
import { requireAuthenticatedUser } from '../http/auth-guards.js';

type AddressRouteOptions = {
  authenticate?: preHandlerHookHandler;
  directory?: AddressDirectory;
};

export const registerAddressRoutes = (
  app: FastifyInstance,
  options: AddressRouteOptions = {},
) => {
  const directory = options.directory ?? new AddressDirectory();
  const authenticate = options.authenticate ?? requireAuthenticatedUser;

  app.get('/address/provinces', { preHandler: authenticate }, () =>
    directory.getProvinces(),
  );

  app.get(
    '/address/provinces/:provinceCode/wards',
    { preHandler: authenticate },
    (request) => {
      const { provinceCode } = z
        .object({
          provinceCode: z
            .string()
            .regex(/^p-[a-z0-9-]{1,62}$/)
            .max(64),
        })
        .parse(request.params);
      return directory.getWards(provinceCode);
    },
  );
};
