# FF RESTaurent 1.1.0

Release date: 2026-07-21

Release tag: `v1.1.0` (annotated, on `main` at `7b3a315`)

GitHub release: https://github.com/newtc22222/ff-restaurent/releases/tag/v1.1.0

Release lineage: `v1.1.0-rc.1` /
`4e63ddc7b28206e16cc024eb912dd0a40e19e64d` → `main` merge `7b3a315`
(PR #34, `develop` → `main`).

## Overview

Version 1.1.0 completes Phase 2 as a backward-compatible minor release. It adds
the security, retention, discovery, restaurant-catalog, feedback, and delivery
foundations implemented and observed in `v1.1.0-rc.1`, applies the verified
FF-38 contract migration, and — via the PR #34 `develop` → `main` merge — also
ships the Supabase media storage, payment-QR workflows, bundled Vietnam address
directory, and bidirectional cursor pagination that were previously held on
`develop`. The shipped `main` tree carries 17 migrations.

## Highlights

- Singleton ROOT_ADMIN governance, safe ownership transfer, session
  invalidation, authenticated password changes, and assisted password recovery.
- Vietnamese phone normalization and exact username-before-phone login lookup.
- Localized `react-hot-toast` result feedback across the web application.
- Flexible statistics, bill activity history, notification controls, reusable
  participant groups, feedback, and duplicate-bill protection.
- Proportional and equal bill adjustments.
- Structured Vietnamese addresses backed by a bundled province/ward directory,
  enriched restaurant profiles, Cuisine and Dining Area catalogs, shareable
  Collections, and scalable search / filter / bidirectional cursor pagination.
- Supabase-backed managed images and payment-QR workflows.
- Route-level web delivery optimization, measured database indexes,
  network-only handling for authenticated API traffic, and viewer-scoped
  restaurant favorite-membership queries.

## FF-38 contract migration

Migration `20260720000000_contract_phase2_normalized_restaurants` is the Phase 2
contract gate (the 14th migration in the accepted RC lineage; the shipped `main`
tree carries 17 migrations in total). It fails closed unless every restaurant
has exactly one primary Cuisine, every user has exactly one Favorites
collection, exactly one Recommended collection exists, and all legacy favorites,
recommendations, and platform links have normalized equivalents.

After those checks pass it removes `UserFavorite` and the legacy
`RestaurantEntry.cuisineType`, `links`, `isFavorite`, and `isRecommended`
columns. Collections and normalized Cuisine relations are the only persistence
authority. Existing clients retain the same response aliases and deprecated
write inputs remain accepted at the API boundary.

The obsolete backfill command is replaced by:

```bash
npm run prisma:phase2:contract:verify -w @ff-restaurent/api
```

The verifier checks the contract migration by name so it stays compatible with
the later migrations added on top of it.

## Pre-contract production evidence

- Accepted RC source: `main` at
  `4e63ddc7b28206e16cc024eb912dd0a40e19e64d`.
- Final repeat operation: GitHub Actions run
  [29760632288](https://github.com/newtc22222/ff-restaurent/actions/runs/29760632288).
  It reported `passed=true`, no exceptions, and zero created records. Counts
  remained 7 users, 1 restaurant, 7 Favorites collections, 1 Recommended
  collection, 1 membership, and 13 migrations.
- Authenticated pre-contract smoke: run
  [29760727991](https://github.com/newtc22222/ff-restaurent/actions/runs/29760727991),
  passed.
- Snapshot-consistent pre-contract recovery: run
  [29760730272](https://github.com/newtc22222/ff-restaurent/actions/runs/29760730272),
  passed with exact snapshot/restored counts: Bill 1, Collection 8,
  CollectionRestaurant 1, Cuisine 1, RestaurantCuisine 1, RestaurantEntry 1,
  RoleAuditLog 4, User 7, and `_prisma_migrations` 13.

The observation window exceeded 24 hours and continued for several days. The
July 20 scheduled smoke failure in run
[29715958940](https://github.com/newtc22222/ff-restaurent/actions/runs/29715958940)
was a Render cold-start `UND_ERR_HEADERS_TIMEOUT`; later deployment smoke
[29721550710](https://github.com/newtc22222/ff-restaurent/actions/runs/29721550710)
and scheduled checks passed. Final smoke now uses bounded per-attempt timeouts
and retries, and the temporary four-hour observation schedule is removed.

## Release execution

- Release implementation merge: PR #34 merged `develop` into `main` at
  `7b3a315`, promoting the full Phase 2 line plus the media, payment-QR,
  address-directory, and pagination work.
- Repository CI: the `verify` workflow (lint, typecheck, unit tests, build, and
  Playwright e2e) passed on the merged release content — run
  [29846439200](https://github.com/newtc22222/ff-restaurent/actions/runs/29846439200)
  (commit `f4749d1`).
- Annotated tag `v1.1.0` created on `7b3a315`; GitHub release published at
  https://github.com/newtc22222/ff-restaurent/releases/tag/v1.1.0.

The following production-deployment evidence is recorded once the release is
deployed and verified against production:

- Contract verification run on the deployed `main` SHA and normalized counts: pending.
- Authenticated deployment smoke run: pending.
- Snapshot-consistent 17-migration recovery run and matching counts: pending.

Any migration, CI, deployment, smoke, contract, or recovery failure blocks the
production sign-off.

## Required production sequence

The API container remains ordered as Prisma migrate deploy, phone
normalization, ROOT_ADMIN bootstrap, then `exec node dist/server.js`, preserving
Node as PID 1. After deployment, run the contract verifier, authenticated smoke,
and snapshot-consistent recovery drill.

## Roadmap boundary

The Linear Phase 2 milestone remains complete. With PR #34 the previously
out-of-scope post-candidate `develop` work (media storage, payment QR, bundled
address data, and the later migrations) is now part of v1.1.0. The overall FF
RESTaurent roadmap remains In Progress because later phases are still ahead.
