import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('media storage remains on Supabase unless FF-71 is explicitly resumed', async () => {
  const [apiPackage, environment, config, storage, deployment] =
    await Promise.all([
      read('apps/api/package.json'),
      read('.env.example'),
      read('apps/api/src/config/config.ts'),
      read('apps/api/src/services/storage.ts'),
      read('.github/workflows/gcp-deploy.yml'),
    ]);

  const apiDependencies = JSON.parse(apiPackage).dependencies;
  assert.ok(apiDependencies['@supabase/supabase-js']);
  assert.equal(apiDependencies['@google-cloud/storage'], undefined);

  for (const variable of [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_PUBLIC_BUCKET',
    'SUPABASE_QR_BUCKET',
    'SUPABASE_SIGNED_URL_TTL_SECONDS',
  ]) {
    assert.match(environment, new RegExp(`^${variable}=`, 'm'));
    assert.match(config, new RegExp(`\\b${variable}\\b`));
  }

  assert.match(storage, /from '@supabase\/supabase-js'/);
  assert.match(storage, /\bcreateClient\(/);
  assert.doesNotMatch(storage, /@google-cloud\/storage/);

  assert.match(deployment, /SUPABASE_URL=ff-supabase-url:latest/);
  assert.match(
    deployment,
    /SUPABASE_SERVICE_ROLE_KEY=ff-supabase-service-role-key:latest/,
  );
  assert.doesNotMatch(deployment, /\bGCS_(?:PUBLIC|QR)_BUCKET\b/);
});
