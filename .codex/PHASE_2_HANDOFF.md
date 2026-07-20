# Phase 2 Handoff

Last updated: 2026-07-20

## Resume here

Phase 2 implementation and the `v1.1.0-rc.1` observation window are complete.
The final v1.1.0 release is being cut from the immutable RC production lineage,
not from later `develop` commits. The release implementation PR contains only
migration 14, contract cleanup, smoke hardening, version 1.1.0, and release
evidence scaffolding.

Authoritative release record: `releases/Release_1-1-0.md`.

## Immutable boundaries

- RC tag: `v1.1.0-rc.1`.
- RC production SHA: `4e63ddc7b28206e16cc024eb912dd0a40e19e64d`.
- Final release branch: `release/v1.1.0`, created directly from that `main`
  boundary as an explicit exception because `develop` contains future scope.
- Out of scope: every later `develop` commit, including Supabase media/payment
  QR support and all newer migrations.

## Accepted pre-contract evidence

- Repeat/idempotency: run 29760632288, passed, no exceptions, zero creations,
  13 migrations.
- Authenticated smoke: run 29760727991, passed.
- Snapshot-consistent recovery: run 29760730272, passed with exact counts for
  the dump snapshot and isolated restore.
- Observation: more than 24 hours of successful scheduled smoke evidence.
- July 20 failure disposition: run 29715958940 hit a Render cold-start headers
  timeout; later deployment run 29721550710 and scheduled smokes passed. Smoke
  now retries bounded 20-second attempts.

## Contract boundary

- Migration 14:
  `20260720000000_contract_phase2_normalized_restaurants`.
- Collections are the only favorites/recommendations authority.
- RestaurantCuisine primary relations are the only cuisine authority.
- Compatibility responses still derive `cuisineType`, `isRecommended`,
  `isFavoritedByMe`, and the `isFavorite` alias.
- The former Phase 2 backfill command is retired. Use
  `npm run prisma:phase2:contract:verify -w @ff-restaurent/api` after deploy.

## Local release verification

- Representative 13-migration RC upgrade and all seven fail-closed conditions:
  passed.
- Clean database migration through all 14 migrations: passed.
- Post-contract schema/invariant verifier: passed with migrationCount 14 and
  zero invariant/schema-removal violations.
- Prisma schema validation and FF-27 index plans (4/4): passed.
- Changed-file Prettier check, workspace lint, typecheck, and production builds:
  passed.
- Database-enabled API suite: 46/46 passed.
- Default suites: API 30 passed/16 integration skipped, web 60/60, shared
  12/12, and smoke retry tests 2/2.
- Playwright: 7/7 passed on isolated API/web ports. The first local attempt
  reused user-owned servers from the dirty checkout; no processes were stopped,
  and configurable E2E ports now prevent that conflict.

## Production completion checklist

1. Merge the reviewed release PR into `main` after green CI.
2. Wait for migrate -> phone normalize -> root bootstrap -> `exec node`.
3. Run Phase 2 contract verification, authenticated smoke, and recovery drill.
4. Merge an evidence-only PR with exact production SHA/run IDs/counts.
5. Require CI and smoke on the evidence SHA.
6. Create annotated `v1.1.0`, publish it as Latest, and retain rc.1 as a
   prerelease.
7. Port contract/version/docs to current `develop` without restoring legacy
   schema or including it in the release tag.
8. Record final evidence on FF-38 and the Phase 2 Linear milestone. Keep the
   overall roadmap In Progress.
