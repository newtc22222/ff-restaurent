# Production Runbook

## Release gates

The required `verify` check runs deterministic installation, lint, typecheck,
unit and PostgreSQL integration tests, production builds, and the three-role
Playwright smoke suite. Configure `verify` as a required status check on `main`.

Production requires:

- `DATABASE_URL`
- `JWT_SECRET` with at least 32 characters
- `JWT_EXPIRES_IN` (default `8h`)
- `CORS_ORIGINS` as a comma-separated allowlist
- `REGISTRATION_INVITE_CODE` with at least 12 characters
- `ROOT_ADMIN_USERNAME` identifying the existing account to promote when the
  database does not yet have a ROOT_ADMIN

The API deliberately fails production startup when these security controls are
missing. Demo seeding is disabled when `NODE_ENV=production`.

## Session and browser-token policy

The closed-group MVP uses an expiring bearer token in browser local storage.
Tokens expire after eight hours by default and there is no silent renewal;
users sign in again. This accepts local-storage theft risk only for the MVP, so
the web deployment must use HTTPS, avoid third-party scripts, enforce a strict
Content Security Policy, and treat every XSS finding as a credential incident.
Moving to same-site, secure, HTTP-only cookies is the preferred next hardening
step before broad public distribution.

## Deployment

1. Build immutable API and web images from the verified Git SHA. Resolve and
   record their registry digests; deploy by digest rather than by a mutable tag.
2. Back up the database.
3. Run `npm run release:run -w @ff-restaurent/api` as one blocking release job.
   It performs Prisma migration deployment, the idempotent popular-Cuisine
   seed, phone normalization/backfill, and singleton ROOT_ADMIN bootstrap in
   that order. Never run the destructive demo seed in production.
4. Deploy the API image, then verify `/health` and `/ready`.
5. Deploy the web image built with the production `VITE_API_URL`.
6. Run `npm run smoke` with staging URLs and a least-privileged smoke account.
7. Promote only when smoke checks and launch telemetry are healthy.

The API Dockerfile has separate runtime targets:

- `cloud-run` starts only `node dist/server.js` in exec form. Cloud Run injects
  `PORT`; the API listens on that port at `0.0.0.0`. Database release work must
  complete successfully before a service revision is deployed.
- `render` remains the final/default target while Render is the recovery
  boundary. It preserves the shipped Phase 2 startup sequence and hands PID 1
  to Node with `exec`.

The manual `GCP deploy` workflow authenticates with Workload Identity
Federation, builds Git-SHA-tagged images, records immutable digests, waits for
the release job, deploys the private API, verifies health/readiness, then builds
and deploys the private web service. A failed release job stops the workflow
before either service deployment. The `production` target is accepted only
from `main`; public access and traffic cutover remain later migration work.

The workflow's `verification` target uses fixed disposable resources:
`ff_release_verify`, `ff-release-verify-database-url`,
`ff-release-verify-cors-origins`, `ff-restaurent-release-verify`,
`ff-restaurent-api-verify`, and `ff-restaurent-web-verify`. An operator must
create the temporary database, candidate ROOT_ADMIN user, secrets, and private
service placeholders before dispatch, grant the runtime identity access only
to the two temporary secrets, and delete all verification resources after
capturing the sanitized workflow artifact. The permanent `ff_restaurent`
database and FF-56 placeholders are not verification targets.

## Launch telemetry

Fastify request logs provide method, path, status, latency, and request IDs.
The API also emits structured events for `login_succeeded`, `bill_created`,
`payment_status_changed`, and `request_failure`. Alert on readiness failures,
repeated authentication failures/rate limits, and elevated 5xx responses.
Never log credentials, invite codes, JWTs, or request authorization headers.

## Backups and restore drills

Schedule provider-native encrypted daily backups with retention appropriate for
the group. The `Backup restore drill` workflow performs a weekly logical dump
from `PRODUCTION_DATABASE_URL`, restores it into an isolated temporary
PostgreSQL service, and verifies migration history. Restrict the workflow
environment and secret to approved operators.

Record each successful drill date, source snapshot, restored migration count,
duration, and operator in the release record. A failed drill blocks promotion.

### Render-to-Cloud SQL migration rehearsal

FF-58 uses `scripts/rehearse-gcp-migration.sh` from WSL. It is separate from
the scheduled restore drill and reuses the snapshot-consistent FF-55 capture
primitive.

```bash
bash scripts/rehearse-gcp-migration.sh --plan
bash scripts/rehearse-gcp-migration.sh --apply
bash scripts/rehearse-gcp-migration.sh --cleanup
```

The passphrase file defaults to
`~/.config/ff-restaurent/ff-55-passphrase`; its parent directory must be mode
`700` and the file mode `600`. Encrypted capture and sanitized evidence are
written to `~/.local/state/ff-restaurent/ff-58`, which is outside every Git
worktree. Plaintext exists only in a mode-`700` temporary directory removed by
the exit trap.

The apply operation captures one exported, repeatable-read Render snapshot and
restores that exact artifact twice. Each pass recreates `ff_release_verify`,
restores in one transaction, compares source-snapshot counts, awaits the
immutable FF-57 release job, requires zero post-release count drift, and checks
migrations, indexes, normalized restaurant contracts, ROOT_ADMIN, all foreign
keys, monetary allocations, and canonical phones. The database is discarded
and recreated between passes. The FF-55 encrypted artifact remains an
independent fallback.

Only these disposable resources may be created or deleted:

- Database: `ff_release_verify`
- Secrets: `ff-release-verify-database-url` and
  `ff-release-verify-cors-origins`
- Job: `ff-restaurent-release-verify`
- Services: `ff-restaurent-api-verify` and
  `ff-restaurent-web-verify`

The operator command verifies the permanent `ff_restaurent` database, both
FF-56 placeholder revisions, and main-only WIF trust before and after the
rehearsal. It removes temporary secret access, invoker and impersonation
bindings, proxy credentials, services, job, secrets, and database on success or
failure. Run `--cleanup` explicitly after an interrupted operator session; it
refuses names outside the fixed disposable set.

Projected cutover is capture plus the slower restore/release/verification pass
plus deploy/smoke. More than 900 seconds, any row-count drift, an invariant
failure, smoke failure, or incomplete cleanup blocks cutover. Preserve the
encrypted artifact, evidence JSON and their SHA-256 files for review. Never
record the passphrase, database URL, access tokens, or secret values.

## Rollback rehearsal

Before promotion, record the current API/web image digests and database backup.

1. Stop promotion and preserve failure logs and request IDs.
2. If the migration is backward-compatible, redeploy the previous API and web
   digests and run the staging smoke script.
3. If data restoration is required, stop writes, restore the pre-release
   backup into a new database, verify `_prisma_migrations` and row counts, then
   switch `DATABASE_URL` atomically.
4. Verify `/ready`, login, bill visibility, payment state, notifications, and
   role administration.
5. Document the incident and ship a forward migration; do not run `migrate dev`
   or manually delete production migration records.

The rollback is considered rehearsed when the prior images and a restored
database pass the staging smoke workflow without demo data.
