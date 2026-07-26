# Practice Environment — Render + Prisma Postgres

Operator runbook for the FF RESTaurent **practice** environment (FF-70): a
throwaway-safe copy of the stack for clicking around, rehearsing migrations, and
trying operations without touching staging or production.

- **Branch:** `env/practice` (branched from `develop`)
- **Web:** Render static site `ff-restaurent-practice-web`
- **API:** Render Docker web service `ff-restaurent-practice-api`
- **Database:** Prisma Postgres (Render's managed PostgreSQL is being retired)
- **Blueprint:** [`render.yaml`](../render.yaml) on `env/practice`

## How this relates to other tracks

| Track                                   | Relationship                                                                                                                                                               |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `develop` / `main`                      | Changes flow **one way**: `develop` → `env/practice`. Never merge `env/practice` back — its `render.yaml` is environment-specific and would clobber production's.          |
| GCP / Cloud Run migration (FF-56…FF-60) | **Independent.** `scripts/retire-render.sh` and `.github/workflows/gcp-deploy.yml` target the production Render services. Do not point them at `ff-restaurent-practice-*`. |

> `CLAUDE.md` references a `wiki/` directory for operator guides; that directory is
> no longer in the repo, so this runbook lives under `docs/`.

## 1. Provision the Prisma Postgres database

1. Prisma Console → create a project and database.
2. **Connect to your database → Generate new connection string.**
3. Copy the **direct** connection string:

   ```
   postgres://USER:PASSWORD@db.prisma.io:5432/?sslmode=require
   ```

**Use the direct string, not the pooled or `prisma+postgres://` one.** The same
`DATABASE_URL` serves both the running API — an unextended `new PrismaClient()`
([`apps/api/src/prisma.ts`](../apps/api/src/prisma.ts)) — and the migration/release
commands, and `schema.prisma` has no `directUrl` to separate them. The direct string
satisfies both with zero code changes. Pooled + `directUrl` would require a schema
change affecting every environment; Accelerate adds a hop a long-lived Render Node
process doesn't need. Migrations over a pooler are the usual source of hangs, which is
the main reason to prefer direct here.

Pick the Prisma region closest to whichever Render region you choose in step 3.

## 2. Migrate and seed — before the first API deploy

**Order matters.** Do this from a workstation, against the direct URL, _before_ the
Render API service exists or first deploys.

```bash
DATABASE_URL="postgres://USER:PASSWORD@db.prisma.io:5432/?sslmode=require" npm run prisma:migrate:deploy -w @ff-restaurent/api
```

```bash
DATABASE_URL="postgres://USER:PASSWORD@db.prisma.io:5432/?sslmode=require" npm run prisma:seed -w @ff-restaurent/api
```

### Why the order matters

The API container **serves only** — `render.yaml` sets `dockerCommand: node dist/server.js`,
overriding the Dockerfile's `render` stage CMD (see "Release step" below). So nothing
migrates or seeds the database on your behalf: an unmigrated database yields a running
API that throws on the first query, and an unseeded one has no accounts to log in with.

`prisma:seed` creates `fifine` already carrying `SystemRole.ROOT_ADMIN`, which is also
what makes the release job's `prisma:root:bootstrap` step a no-op rather than an error.

`seed()` defaults to `reset: true` and truncates every table — correct for a fresh
practice database, and the reason it runs before any traffic exists.

### Seeded accounts

| Username   | Role                   | Password      |
| ---------- | ---------------------- | ------------- |
| `fifine`   | HEAD_CHEF + ROOT_ADMIN | `111222333`   |
| `head`     | HEAD_CHEF              | `password123` |
| `sous`     | SOUS_CHEF              | `password123` |
| `customer` | CUSTOMER               | `password123` |

`User.systemRole` is `@unique`, so exactly one account can hold ROOT_ADMIN — `fifine`
holds it, and `head` is a plain HEAD_CHEF. `ROOT_ADMIN_USERNAME` in `render.yaml` is
set to `fifine` to match.

These are demo credentials for a practice environment only. Never reuse this seed
against staging or production.

## 3. Create the Render Blueprint

Render Dashboard → **New → Blueprint** → this repository → branch **`env/practice`** → Apply.

The blueprint creates both services from [`render.yaml`](../render.yaml). Both are
named `-practice` so this blueprint instance cannot collide with or adopt the
production `ff-restaurent` service.

The API builds `apps/api/Dockerfile` with no target — its **final** stage is `render`.
Do not reorder the Dockerfile stages without revisiting this.

That stage's CMD chains migrate + cuisine seed + phone backfill + root bootstrap before
listening, which `render.yaml` deliberately **overrides** with
`dockerCommand: node dist/server.js`. The Dockerfile itself is unchanged, so this branch
does not diverge from `develop` there — only `render.yaml` does.

### Environment variables to fill in

Everything marked `sync: false` must be set in the dashboard after the services exist.

| Key                         | Service | Value                                                           |
| --------------------------- | ------- | --------------------------------------------------------------- |
| `DATABASE_URL`              | api     | Prisma direct string from step 1                                |
| `CORS_ORIGINS`              | api     | `https://ff-restaurent-practice-web.onrender.com`               |
| `REGISTRATION_INVITE_CODE`  | api     | Your choice, **≥ 12 characters**                                |
| `SUPABASE_URL`              | api     | Practice Supabase project URL                                   |
| `SUPABASE_SERVICE_ROLE_KEY` | api     | Practice service-role key (**API-only, never exposed to Vite**) |
| `VITE_API_URL`              | web     | `https://ff-restaurent-practice-api.onrender.com`               |

`JWT_SECRET` uses `generateValue: true`, so Render creates it. `ROOT_ADMIN_USERNAME`,
`JWT_EXPIRES_IN`, and the Supabase bucket names are set in the blueprint.

`CORS_ORIGINS` and `VITE_API_URL` are circular — each names the other service. Render
URLs are `https://<service-name>.onrender.com`, so both can be filled in up front from
the service names; confirm after creation in case a name was taken.

### Startup requirements the container enforces

`NODE_ENV=production` is baked into the Dockerfile runtime stage, so
[`apps/api/src/config.ts`](../apps/api/src/config.ts) **refuses to start** unless:

- `JWT_SECRET` is ≥ 32 characters
- `CORS_ORIGINS` is non-empty
- `REGISTRATION_INVITE_CODE` is ≥ 12 characters

These fail the boot, not individual requests — a misconfigured value looks like a
crash-loop in the Render logs, not a 500.

### Release step — run after any migration-bearing deploy

Because the container serves only, schema changes are applied by a **one-shot release
job**, the same script the Cloud Run track uses
([`apps/api/scripts/run-release-job.sh`](../apps/api/scripts/run-release-job.sh)):
migrate deploy → phone backfill → root-admin bootstrap, each step logged and failing
fast.

```bash
DATABASE_URL="postgres://USER:PASSWORD@db.prisma.io:5432/?sslmode=require" npm run release:run -w @ff-restaurent/api
```

Run it from a workstation after deploying a commit that adds migrations. Deploys with
no schema change need nothing. Skipping it when a migration _was_ added leaves the API
running against an outdated schema — it starts fine and throws at query time, so watch
for query errors rather than a boot failure.

Render's `preDeployCommand` would automate this, but it is **paid-plan only**; on a
paid instance, set it to `npm run release:run -w @ff-restaurent/api` and drop the manual
step.

### Free plan and cold starts

Both services are on `plan: free`. Render spins a free service down after **15 minutes**
without inbound traffic, and spin-up takes **about one minute**.

The `dockerCommand` override matters here. The stock `render` CMD took a measured **~52
seconds** — 29s to `prisma migrate deploy`, then ~5s, ~7s and ~5s for the seed, backfill
and bootstrap steps — before Fastify ever listened, and a spin-down restart re-runs the
whole chain. Serving only removes that from every cold start.

Prisma Postgres itself has **no cold start and no idle suspend**, so the database is not
a factor in any of this — only the Render container is.

`scripts/staging-smoke.mjs` retries six times with backoff, so the smoke suite rides out
a spin-up; a browser hitting a cold service just waits.

`VITE_API_URL` is read at **build** time by Vite. Changing it requires a web rebuild
("Clear build cache & deploy"), not a restart.

## 4. Verify

Against the Prisma database, from a workstation:

```bash
DATABASE_URL="postgres://USER:PASSWORD@db.prisma.io:5432/?sslmode=require" npm run prisma:phase2:contract:verify -w @ff-restaurent/api
```

```bash
DATABASE_URL="postgres://USER:PASSWORD@db.prisma.io:5432/?sslmode=require" npm run prisma:indexes:verify -w @ff-restaurent/api
```

Both confirm the Phase 2 invariants survived the move to Prisma Postgres.

Against the deployed services:

```bash
curl https://ff-restaurent-practice-api.onrender.com/health
```

Expect `{"ok":true}`. Swagger UI is at `/api/docs`.

`/ready` additionally round-trips the database and returns 503 if it is unreachable —
use it to confirm `DATABASE_URL` is right, since `/health` answers even when the
database does not:

```bash
curl https://ff-restaurent-practice-api.onrender.com/ready
```

End to end:

```bash
API_URL=https://ff-restaurent-practice-api.onrender.com WEB_URL=https://ff-restaurent-practice-web.onrender.com SMOKE_USERNAME=fifine SMOKE_PASSWORD=111222333 npm run smoke
```

Then load the web URL and log in as `fifine` — seeded restaurants and bills rendering
proves web → API → Prisma Postgres end to end, and that `CORS_ORIGINS` is right.

## 5. Day-to-day operations

### Deploy a change

Merge or cherry-pick from `develop` into `env/practice` and push. CI runs on pushes to
`env/practice` ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)), and Render
auto-deploys both services on commit.

If the change adds a migration, run the release step above once the deploy is live.

### Reset the practice database

Re-run the seed; `reset: true` truncates first.

```bash
DATABASE_URL="postgres://USER:PASSWORD@db.prisma.io:5432/?sslmode=require" npm run prisma:seed -w @ff-restaurent/api
```

### Troubleshooting

| Symptom                                                                                  | Cause                                                                                     |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| API crash-loops, logs mention `JWT_SECRET` / `CORS_ORIGINS` / `REGISTRATION_INVITE_CODE` | Production config guard; see startup requirements above                                   |
| API crash-loops, logs mention `ROOT_ADMIN_USERNAME`                                      | `dockerCommand` override was lost, so the stock CMD ran bootstrap on an unseeded database |
| API starts fine but queries throw about missing tables or columns                        | Migration-bearing deploy without the release step — run it                                |
| `/health` returns ok but `/ready` returns 503                                            | `DATABASE_URL` is wrong or the database is unreachable                                    |
| First request after idle takes ~1 minute                                                 | Free-plan spin-down after 15 minutes; expected, not a fault                               |
| Web loads but every API call fails CORS                                                  | `CORS_ORIGINS` missing the `https://` scheme, or pointed at the wrong host                |
| Web calls `localhost:4000`                                                               | `VITE_API_URL` was unset or changed at build time — rebuild the static site               |
| Migrations hang or refuse to connect                                                     | Pooled or `prisma+postgres://` string in `DATABASE_URL` instead of the direct one         |
