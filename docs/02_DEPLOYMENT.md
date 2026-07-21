# Deployment Guide

This guide lists the preparation work and deployment-stage steps for releasing FF RESTaurent. It assumes the current monorepo layout:

- `apps/api` - Fastify API, Prisma, PostgreSQL, JWT auth
- `apps/web` - React/Vite frontend served as static files
- `packages/shared` - shared TypeScript types and bill-splitting logic

---

## Deployment Targets

The app can be deployed as:

- A Docker Compose stack on a VPS, running Postgres, API, and web containers together.
- A split deployment, with Postgres on a managed database, the API on a Node/container host, and the web app on a static host or CDN.

The current repository already includes:

- `apps/api/Dockerfile`
- `apps/web/Dockerfile`
- `docker-compose.yml`
- `.github/workflows/ci.yml`

---

## Prepare Before Deployment

### 1. Confirm Required Environment Variables

Create production values for every required variable. Do not reuse local development secrets.

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/ff_restaurent?schema=public
JWT_SECRET=replace-with-a-long-random-production-secret
API_PORT=4000
VITE_API_URL=https://api.example.com
```

Important notes:

- `JWT_SECRET` must be a long, random secret and must not be committed.
- `VITE_API_URL` is baked into the frontend build at build time.
- For Docker Compose on one host, the API can use the internal Postgres host name from Compose.
- For managed Postgres, use the provider connection string and confirm SSL requirements.

### 2. Review Database State

Before deploying a new API build:

1. Confirm the production database is reachable from the deployment environment.
2. Confirm migration files are committed under `apps/api/prisma/migrations`.
3. Back up the production database before applying migrations.
4. Check whether the migration includes destructive changes.

Production migrations should use Prisma deploy mode:

```bash
npm run prisma:migrate:deploy -w @ff-restaurent/api
npm run prisma:cuisines:seed -w @ff-restaurent/api
```

Do not run `prisma migrate dev` against production.

### 3. Run Local Verification

Run these from the repository root before promoting a release:

```bash
npm install
npm run build -w @ff-restaurent/shared
npm run typecheck
npm test
npm run build
```

If `packages/shared` changes, rebuild it before API or web verification because both apps consume the compiled `dist` output.

### 4. Confirm Docker Builds

Build both production images before release:

```bash
docker build -f apps/api/Dockerfile -t ff-restaurent-api:release .
docker build -f apps/web/Dockerfile --build-arg VITE_API_URL=https://api.example.com -t ff-restaurent-web:release .
```

For a single-host Compose release, verify the full stack:

```bash
docker compose up --build
```

---

## Deployment Stage Checklist

### 1. Freeze the Release Version

Use a specific Git commit, tag, or image digest for deployment. Avoid deploying from an unpinned local working tree.

Recommended release identifiers:

- Git tag, for example `v0.1.0`
- Docker image tag, for example `ghcr.io/OWNER/ff-restaurent-api:v0.1.0`
- Git SHA for traceability

### 2. Provision Infrastructure

Minimum required services:

- PostgreSQL 16-compatible database
- API runtime with Node.js 22 or the API Docker image
- Static web host, Nginx container, or CDN for the web build
- HTTPS termination through a reverse proxy, load balancer, or hosting provider

For a VPS deployment, place a reverse proxy such as Nginx, Caddy, or Traefik in front of:

- Web frontend: public root domain, for example `https://app.example.com`
- API: public API domain, for example `https://api.example.com`

### 3. Configure Production Secrets

Set secrets in the deployment platform, not in Git:

- `DATABASE_URL`
- `JWT_SECRET`
- `API_PORT`
- `VITE_API_URL` as a build-time value for the web image

Rotate `JWT_SECRET` deliberately. Changing it invalidates existing JWT sessions.

### 4. Build and Publish Artifacts

Build order matters:

```bash
npm run build -w @ff-restaurent/shared
npm run build -w @ff-restaurent/api
npm run build -w @ff-restaurent/web
```

For container deployment:

```bash
docker build -f apps/api/Dockerfile -t ff-restaurent-api:VERSION .
docker build -f apps/web/Dockerfile --build-arg VITE_API_URL=https://api.example.com -t ff-restaurent-web:VERSION .
docker push ff-restaurent-api:VERSION
docker push ff-restaurent-web:VERSION
```

### 5. Apply Database Migrations

Run migrations once per deployment before starting the new API version:

```bash
npm run prisma:migrate:deploy -w @ff-restaurent/api
npm run prisma:cuisines:seed -w @ff-restaurent/api
```

The current `docker-compose.yml` starts the API with:

```bash
npx prisma migrate deploy && npm run prisma:cuisines:seed && exec node dist/server.js
```

The local Compose command also runs the development-only demo seed before the
catalog seed. Production never runs the demo seed. For stricter production
environments, prefer running migrations and the idempotent catalog seed as a
separate release job so failures stop the deployment before the API container
is replaced.

### 6. Start or Update Services

For Docker Compose:

```bash
docker compose pull
docker compose up -d
```

For a managed platform:

1. Deploy the API image or Node bundle.
2. Deploy the web static build or web image.
3. Confirm the web app points to the production API URL.
4. Restart services only after migrations have succeeded.

### 7. Run Smoke Tests

After deployment, verify:

```bash
curl https://api.example.com/health
```

Then check manually:

- Web app loads over HTTPS.
- Login works for a real account.
- API docs are available if intentionally exposed at `/api/docs`.
- Bills list loads.
- A user can view their own bill shares.
- A SOUS_CHEF or HEAD_CHEF can access manager actions.
- A payment status update persists after refresh.

### 8. Monitor the Release

Watch these immediately after deployment:

- API process restarts or crashes
- Prisma migration errors
- Database connection errors
- CORS failures from the web app
- 4xx/5xx API response spikes
- Web asset loading failures

At minimum, keep `/health` monitored by the hosting platform or an uptime monitor.

### 9. Rollback Plan

Before release, know how to roll back:

1. Re-deploy the previous API and web image tags.
2. Restore the database backup if the migration changed data destructively.
3. Re-run smoke tests after rollback.
4. Record the failed version, migration name, and error logs.

Database rollbacks are not automatic with Prisma. Treat migrations as forward-only unless a tested rollback script exists.

---

## CI/CD Pipelines

### Current CI Pipeline

The repository already has `.github/workflows/ci.yml` running on pull requests and pushes to `main`.

Current CI steps:

```yaml
- npm install
- npm run build -w @ff-restaurent/shared
- npm run typecheck
- npm test
- npm run build
```

This is the required minimum gate before deployment. Keep it passing before merging release branches.

### Recommended PR Pipeline

Run on every pull request:

1. Check out code.
2. Install Node.js 22.
3. Install dependencies with `npm install` or `npm ci`.
4. Build `@ff-restaurent/shared`.
5. Run typecheck across workspaces.
6. Run tests.
7. Build all workspaces.
8. Optionally build API and web Docker images without pushing.

Suggested additions:

```yaml
- run: docker build -f apps/api/Dockerfile -t ff-restaurent-api:ci .
- run: docker build -f apps/web/Dockerfile --build-arg VITE_API_URL=http://localhost:4000 -t ff-restaurent-web:ci .
```

### Recommended Main Branch Pipeline

Run after CI passes on `main`:

1. Build API Docker image.
2. Build web Docker image with production `VITE_API_URL`.
3. Tag images with the Git SHA and optionally a release tag.
4. Push images to a registry.
5. Trigger the deployment environment.

Recommended image tags:

```text
ff-restaurent-api:${{ github.sha }}
ff-restaurent-web:${{ github.sha }}
```

### Recommended Deployment Pipeline

Use a separate deployment job or environment with manual approval for production.

Deployment job order:

1. Pull the exact image tags produced by the build pipeline.
2. Apply production secrets from the CI/CD secret store.
3. Run `npm run prisma:migrate:deploy -w @ff-restaurent/api`, then
   `npm run prisma:cuisines:seed -w @ff-restaurent/api`, as one-time database
   preparation steps.
4. Deploy or restart the API service.
5. Deploy or restart the web service.
6. Run smoke tests against `/health` and the frontend URL.
7. Mark the deployment successful only after smoke tests pass.

### Required CI/CD Secrets

Configure these in the CI/CD platform:

- `DATABASE_URL`
- `JWT_SECRET`
- `VITE_API_URL`
- Container registry credentials, if pushing images
- Deployment host or provider credentials

Do not print secret values in logs.

### Deployment Protection Rules

For production, use:

- Required passing CI before deploy.
- Manual approval before production deployment.
- One deployment at a time.
- Environment-specific secrets.
- Release notes or a linked Git commit for traceability.

---

## Production Readiness Notes

Before handling real user data, confirm:

- HTTPS is enabled for both web and API traffic.
- CORS only allows trusted frontend origins.
- Database backups are scheduled and restore-tested.
- Logs are retained somewhere outside the container filesystem.
- `JWT_SECRET` is stored in a secret manager or protected environment variable.
- API docs exposure at `/api/docs` is intentional for the environment.
- Demo seed data is not inserted into production unless explicitly desired.
