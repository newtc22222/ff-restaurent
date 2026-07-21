const MIN_PRODUCTION_SECRET_LENGTH = 32;

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
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    supabasePublicBucket:
      process.env.SUPABASE_PUBLIC_BUCKET ?? 'ff-public-images',
    supabaseQrBucket: process.env.SUPABASE_QR_BUCKET ?? 'ff-payment-qr',
    supabaseSignedUrlTtlSeconds: positiveInteger(
      process.env.SUPABASE_SIGNED_URL_TTL_SECONDS,
      900,
    ),
  };
};
