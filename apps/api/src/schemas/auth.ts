import { z } from 'zod';
import { vietnamMobilePhoneSchema } from './common.js';

/** Login, registration, profile, and password-recovery request bodies. */

export const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

export const registerSchema = z.object({
  name: z.string().min(1),
  username: z.string().min(3).max(30),
  phone: vietnamMobilePhoneSchema.optional(),
  password: z.string().min(8),
  inviteCode: z.string().min(1),
});

export const profileUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  username: z.string().min(3).max(30).optional(),
  phone: vietnamMobilePhoneSchema.optional(),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string(),
  confirmation: z.string(),
});

export const passwordResetRequestSchema = z.object({
  identifier: z.string().trim().min(1).max(100),
});

export const passwordResetConsumeSchema = z.object({
  identifier: z.string().trim().min(1).max(100),
  code: z.string().trim().length(8),
  newPassword: z.string(),
  confirmation: z.string(),
});
