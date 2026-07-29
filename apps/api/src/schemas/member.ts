import { z } from 'zod';

import {
  CHEF_ROLE_VALUES,
  USER_ACCOUNT_STATUS_VALUES,
} from '@ff-restaurent/shared';

/** Member directory queries and role administration bodies. */

export const memberQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  cursor: z.string().min(1).optional(),
  direction: z.enum(['forward', 'backward']).default('forward'),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.enum(['name-asc', 'name-desc', 'created-desc']).default('name-asc'),
});

export const chefRoleSchema = z.object({
  chefRole: z.enum(CHEF_ROLE_VALUES).nullable(),
});

export const userAccountStatusSchema = z.object({
  accountStatus: z.enum(USER_ACCOUNT_STATUS_VALUES),
});

export const rootAdminTransferSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  targetUsername: z.string().min(3).max(30),
  confirmationUsername: z.string().min(3).max(30),
});
