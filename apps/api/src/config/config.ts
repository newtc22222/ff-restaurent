import { z } from 'zod';

/**
 * Environment configuration, validated once at startup.
 *
 * Previously each consumer called `loadConfig()` and re-read `process.env`, so
 * a misconfiguration could surface on the first request that happened to touch
 * a given module rather than at boot. The schema below is evaluated on first
 * access and cached, so the process either starts with valid configuration or
 * fails immediately.
 */

const MIN_PRODUCTION_SECRET_LENGTH = 32;
const MIN_PRODUCTION_INVITE_LENGTH = 12;
const DEFAULT_SIGNED_URL_TTL_SECONDS = 900;

const csvList = z
  .string()
  .optional()
  .transform((value) =>
    (value ?? '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  );

/** Falls back rather than failing, matching the previous lenient behaviour. */
const positiveIntegerWithDefault = (fallback: number) =>
  z
    .string()
    .optional()
    .transform((value) => {
      const parsed = Number(value);
      return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
    });

const envSchema = z.object({
  NODE_ENV: z.string().optional(),
  JWT_SECRET: z.string().default('dev-only-change-me'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  CORS_ORIGINS: csvList,
  REGISTRATION_INVITE_CODE: z.string().optional(),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_PUBLIC_BUCKET: z.string().default('ff-public-images'),
  SUPABASE_QR_BUCKET: z.string().default('ff-payment-qr'),
  SUPABASE_SIGNED_URL_TTL_SECONDS: positiveIntegerWithDefault(
    DEFAULT_SIGNED_URL_TTL_SECONDS,
  ),
});

type ParsedEnv = z.infer<typeof envSchema>;

export type AppConfig = {
  isProduction: boolean;
  jwtSecret: string;
  jwtExpiresIn: string;
  corsOrigins: string[];
  registrationInviteCode: string;
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
  supabasePublicBucket: string;
  supabaseQrBucket: string;
  supabaseSignedUrlTtlSeconds: number;
};

/*
 * Production hardening, asserted against the raw environment rather than the
 * derived config — the invite-code rule requires the variable to be *set*, not
 * merely defaulted, which the derived value can no longer distinguish.
 *
 * Thrown as plain errors rather than Zod issues so the messages stay
 * byte-identical to the previous implementation; the deployment runbooks quote
 * them.
 */
const assertProductionSafety = (env: ParsedEnv) => {
  if (env.NODE_ENV !== 'production') return;
  if (env.JWT_SECRET.length < MIN_PRODUCTION_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET must be at least ${MIN_PRODUCTION_SECRET_LENGTH} characters in production`,
    );
  }
  if (env.CORS_ORIGINS.length === 0) {
    throw new Error('CORS_ORIGINS must contain at least one trusted origin');
  }
  if (
    !env.REGISTRATION_INVITE_CODE ||
    env.REGISTRATION_INVITE_CODE.length < MIN_PRODUCTION_INVITE_LENGTH
  ) {
    throw new Error(
      'REGISTRATION_INVITE_CODE must be at least 12 characters in production',
    );
  }
};

const toConfig = (env: ParsedEnv): AppConfig => ({
  isProduction: env.NODE_ENV === 'production',
  jwtSecret: env.JWT_SECRET,
  jwtExpiresIn: env.JWT_EXPIRES_IN,
  corsOrigins: env.CORS_ORIGINS,
  registrationInviteCode: env.REGISTRATION_INVITE_CODE ?? 'local-dev-invite',
  supabaseUrl: env.SUPABASE_URL,
  supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  supabasePublicBucket: env.SUPABASE_PUBLIC_BUCKET,
  supabaseQrBucket: env.SUPABASE_QR_BUCKET,
  supabaseSignedUrlTtlSeconds: env.SUPABASE_SIGNED_URL_TTL_SECONDS,
});

let cached: AppConfig | undefined;

/**
 * Returns the validated configuration, parsing `process.env` on first call.
 *
 * Still safe to call anywhere — it is now a cached lookup rather than a
 * re-parse — but prefer the `app.config` decoration inside request handling.
 */
export const loadConfig = (): AppConfig => {
  if (cached) return cached;
  const env = envSchema.parse(process.env);
  assertProductionSafety(env);
  cached = toConfig(env);
  return cached;
};

/**
 * Clears the memoized configuration so a test can observe a different
 * environment. Production code should never call this.
 */
export const resetConfigForTests = () => {
  cached = undefined;
};
