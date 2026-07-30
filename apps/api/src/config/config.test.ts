import assert from 'node:assert/strict';
import test from 'node:test';

import { loadConfig, resetConfigForTests } from './config.js';

/**
 * These assert the two properties M-2 asks for: the environment is parsed once
 * rather than per consumer, and production misconfiguration fails loudly with
 * the exact messages the deployment runbooks quote.
 */

const withEnv = <T>(
  overrides: Record<string, string | undefined>,
  run: () => T,
) => {
  const previous = { ...process.env };
  Object.assign(process.env, overrides);
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
  }
  resetConfigForTests();
  try {
    return run();
  } finally {
    process.env = previous;
    resetConfigForTests();
  }
};

test('parses the environment once and caches the result', () => {
  withEnv({ NODE_ENV: 'test', JWT_SECRET: 'first-secret' }, () => {
    const first = loadConfig();
    assert.equal(first.jwtSecret, 'first-secret');

    // A later change to the environment must not be observed by a later call.
    process.env.JWT_SECRET = 'second-secret';
    const second = loadConfig();
    assert.equal(second.jwtSecret, 'first-secret');
    assert.equal(first, second, 'the same object should be returned');
  });
});

test('applies documented defaults outside production', () => {
  withEnv(
    {
      NODE_ENV: 'test',
      JWT_SECRET: undefined,
      JWT_EXPIRES_IN: undefined,
      CORS_ORIGINS: undefined,
      REGISTRATION_INVITE_CODE: undefined,
      GCP_PROJECT_ID: undefined,
      GCS_PUBLIC_BUCKET: undefined,
      GCS_QR_BUCKET: undefined,
      GCS_SIGNED_URL_TTL_SECONDS: undefined,
      LEGACY_SUPABASE_PUBLIC_BUCKET: undefined,
    },
    () => {
      const config = loadConfig();
      assert.equal(config.isProduction, false);
      assert.equal(config.jwtSecret, 'dev-only-change-me');
      assert.equal(config.jwtExpiresIn, '8h');
      assert.deepEqual(config.corsOrigins, []);
      assert.equal(config.registrationInviteCode, 'local-dev-invite');
      assert.equal(config.gcpProjectId, undefined);
      assert.equal(config.gcsPublicBucket, undefined);
      assert.equal(config.gcsQrBucket, undefined);
      assert.equal(config.gcsSignedUrlTtlSeconds, 900);
      assert.equal(config.legacySupabasePublicBucket, 'ff-public-images');
    },
  );
});

test('splits and trims the CORS origin list', () => {
  withEnv(
    {
      NODE_ENV: 'test',
      CORS_ORIGINS: ' https://a.example , ,https://b.example ',
    },
    () => {
      assert.deepEqual(loadConfig().corsOrigins, [
        'https://a.example',
        'https://b.example',
      ]);
    },
  );
});

test('falls back for a non-positive or unparseable signed-URL TTL', () => {
  for (const value of ['0', '-5', 'abc', '1.5']) {
    withEnv({ NODE_ENV: 'test', GCS_SIGNED_URL_TTL_SECONDS: value }, () => {
      assert.equal(loadConfig().gcsSignedUrlTtlSeconds, 900);
    });
  }
});

const productionEnv = {
  NODE_ENV: 'production',
  JWT_SECRET: 'x'.repeat(32),
  CORS_ORIGINS: 'https://app.example',
  REGISTRATION_INVITE_CODE: 'a-long-enough-invite',
};

test('accepts a fully configured production environment', () => {
  withEnv(productionEnv, () => {
    const config = loadConfig();
    assert.equal(config.isProduction, true);
    assert.deepEqual(config.corsOrigins, ['https://app.example']);
  });
});

test('rejects a short production JWT secret', () => {
  withEnv({ ...productionEnv, JWT_SECRET: 'too-short' }, () => {
    assert.throws(loadConfig, {
      message: 'JWT_SECRET must be at least 32 characters in production',
    });
  });
});

test('rejects production without a trusted CORS origin', () => {
  withEnv({ ...productionEnv, CORS_ORIGINS: '' }, () => {
    assert.throws(loadConfig, {
      message: 'CORS_ORIGINS must contain at least one trusted origin',
    });
  });
});

test('rejects a missing or short production invite code', () => {
  for (const code of [undefined, 'short']) {
    withEnv({ ...productionEnv, REGISTRATION_INVITE_CODE: code }, () => {
      assert.throws(loadConfig, {
        message:
          'REGISTRATION_INVITE_CODE must be at least 12 characters in production',
      });
    });
  }
});
