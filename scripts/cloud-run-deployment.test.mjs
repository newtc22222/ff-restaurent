import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Cloud Run service target is service-only while Render remains the default', async () => {
  const dockerfile = await read('apps/api/Dockerfile');
  const cloudRunTarget = dockerfile.indexOf('FROM runtime AS cloud-run');
  const renderTarget = dockerfile.indexOf('FROM runtime AS render');

  assert.ok(cloudRunTarget > 0);
  assert.ok(
    renderTarget > cloudRunTarget,
    'Render must remain the final default target',
  );
  assert.match(
    dockerfile.slice(cloudRunTarget, renderTarget),
    /CMD \["node", "dist\/server\.js"\]/,
  );
  assert.doesNotMatch(
    dockerfile.slice(cloudRunTarget, renderTarget),
    /prisma migrate|cuisines:seed|phones:backfill|root:bootstrap/,
  );
  assert.match(
    dockerfile.slice(renderTarget),
    /prisma migrate deploy.*cuisines:seed.*phones:backfill.*root:bootstrap.*exec node dist\/server\.js/s,
  );
});

test('deployment workflow blocks service deployment on the awaited release job', async () => {
  const workflow = await read('.github/workflows/gcp-deploy.yml');
  const executeJob = workflow.indexOf('gcloud run jobs execute "$RELEASE_JOB"');
  const apiDeploy = workflow.indexOf('gcloud run deploy "$API_SERVICE"');
  const webDeploy = workflow.indexOf('gcloud run deploy "$WEB_SERVICE"');

  assert.ok(executeJob > 0);
  assert.ok(apiDeploy > executeJob);
  assert.ok(webDeploy > apiDeploy);
  assert.match(workflow, /test "\$GITHUB_REF" = refs\/heads\/main/);
  assert.match(workflow, /--target cloud-run/);
  assert.match(workflow, /api:\$\{GITHUB_SHA\}/);
  assert.match(workflow, /web:\$\{GITHUB_SHA\}/);
  assert.match(workflow, /API_IMAGE=\$\{api_tag%:\*\}@\$\{api_digest\}/);
  assert.match(workflow, /WEB_IMAGE=\$\{web_tag%:\*\}@\$\{web_digest\}/);
});

test('workflow passes only the public API URL into the web build', async () => {
  const workflow = await read('.github/workflows/gcp-deploy.yml');
  const webBuildStart = workflow.indexOf(
    '- name: Build and push the web image',
  );
  const webDeployStart = workflow.indexOf(
    '- name: Deploy the private web service',
  );
  const webBuild = workflow.slice(webBuildStart, webDeployStart);

  assert.match(webBuild, /--build-arg "VITE_API_URL=\$\{API_URL\}"/);
  assert.doesNotMatch(
    webBuild,
    /JWT_SECRET|DATABASE_URL|REGISTRATION_INVITE_CODE|SUPABASE_SERVICE_ROLE_KEY/,
  );
  assert.match(
    workflow,
    /DATABASE_URL=\$\{DATABASE_SECRET\}:latest.*JWT_SECRET=ff-jwt-secret:latest.*CORS_ORIGINS=\$\{CORS_SECRET\}:latest/s,
  );
});
