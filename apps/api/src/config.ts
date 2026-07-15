const MIN_PRODUCTION_SECRET_LENGTH = 32;

export type AppConfig = {
  isProduction: boolean;
  jwtSecret: string;
  jwtExpiresIn: string;
  corsOrigins: string[];
  registrationInviteCode: string;
  provincesApiUrl: string;
  provincesApiTimeoutMs: number;
  provincesCacheTtlMs: number;
};

const positiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const loadConfig = (): AppConfig => {
  const isProduction = process.env.NODE_ENV === 'production';
  const jwtSecret = process.env.JWT_SECRET ?? 'dev-only-change-me';
  const corsOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const registrationInviteCode =
    process.env.REGISTRATION_INVITE_CODE ?? 'local-dev-invite';

  if (isProduction && jwtSecret.length < MIN_PRODUCTION_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET must be at least ${MIN_PRODUCTION_SECRET_LENGTH} characters in production`,
    );
  }
  if (isProduction && corsOrigins.length === 0) {
    throw new Error('CORS_ORIGINS must contain at least one trusted origin');
  }
  if (
    isProduction &&
    (!process.env.REGISTRATION_INVITE_CODE ||
      registrationInviteCode.length < 12)
  ) {
    throw new Error(
      'REGISTRATION_INVITE_CODE must be at least 12 characters in production',
    );
  }

  return {
    isProduction,
    jwtSecret,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
    corsOrigins,
    registrationInviteCode,
    provincesApiUrl: (
      process.env.PROVINCES_API_URL ?? 'https://provinces.open-api.vn/api/v2/'
    ).replace(/\/*$/, '/'),
    provincesApiTimeoutMs: positiveInteger(
      process.env.PROVINCES_API_TIMEOUT_MS,
      5_000,
    ),
    provincesCacheTtlMs: positiveInteger(
      process.env.PROVINCES_CACHE_TTL_MS,
      86_400_000,
    ),
  };
};
