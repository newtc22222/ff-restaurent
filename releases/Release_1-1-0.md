# FF RESTaurent 1.1.0

Release date: pending final production verification

Release tag: `v1.1.0` (pending)

Release lineage: `v1.1.0-rc.1` / `4e63ddc7b28206e16cc024eb912dd0a40e19e64d`

## Overview

Version 1.1.0 completes Phase 2 as a backward-compatible minor release. It
adds the security, retention, discovery, restaurant-catalog, feedback, and
delivery foundations implemented and observed in `v1.1.0-rc.1`, then applies
the verified FF-38 contract migration. Later `develop` work for media storage,
payment QR libraries, bundled address data, and newer migrations is explicitly
outside this release.

## Highlights

- Singleton ROOT_ADMIN governance, safe ownership transfer, session
  invalidation, authenticated password changes, and assisted password recovery.
- Vietnamese phone normalization and exact username-before-phone login lookup.
- Localized `react-hot-toast` result feedback across the web application.
- Flexible statistics, bill activity history, notification controls, reusable
  participant groups, feedback, and duplicate-bill protection.
- Structured Vietnamese addresses, enriched restaurant profiles, Cuisine and
  Dining Area catalogs, shareable Collections, scalable search/filter/cursor
  pagination, and responsive discovery/member administration.
- Route-level web delivery optimization, measured database indexes, and
  network-only handling for authenticated API traffic.

## FF-38 contract migration

Migration `20260720000000_contract_phase2_normalized_restaurants` is migration 14. It fails closed unless every restaurant has exactly one primary Cuisine,
every user has exactly one Favorites collection, exactly one Recommended
collection exists, and all legacy favorites, recommendations, and platform
links have normalized equivalents.

After those checks pass it removes `UserFavorite` and the legacy
`RestaurantEntry.cuisineType`, `links`, `isFavorite`, and `isRecommended`
columns. Collections and normalized Cuisine relations are the only persistence
authority. Existing clients retain the same response aliases and deprecated
write inputs remain accepted at the API boundary.

The obsolete backfill command is replaced by:

```bash
npm run prisma:phase2:contract:verify -w @ff-restaurent/api
```

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

## Final production evidence

The evidence-only follow-up PR will fill these immutable values after the
release deployment is verified:

- Release implementation merge SHA: pending.
- Contract verification run and normalized counts: pending.
- Authenticated deployment smoke run: pending.
- Snapshot-consistent 14-migration recovery run and matching counts: pending.
- Evidence merge SHA, final CI, and final smoke: pending.
- Annotated tag and GitHub release URL: pending.

Any migration, CI, deployment, smoke, contract, or recovery failure blocks the
tag and GitHub release.

## Required production sequence

The API container remains ordered as Prisma migrate deploy, phone
normalization, ROOT_ADMIN bootstrap, then `exec node dist/server.js`, preserving
Node as PID 1. After deployment, run the contract verifier, authenticated smoke,
and snapshot-consistent recovery drill before creating the final tag.

## Roadmap boundary

The Linear Phase 2 milestone remains complete. The overall FF RESTaurent
roadmap remains In Progress because later phases and the out-of-scope
post-candidate `develop` work are not part of v1.1.0.
