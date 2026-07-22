# Phase 2 Handoff

Last updated: 2026-07-22

## Current boundary

Phase 2 is complete. FF RESTaurent v1.1.0 is published as an annotated Git tag
and GitHub Latest release. The authoritative scope and detailed evidence are in
`releases/Release_1-1-0.md`.

- Release tag: `v1.1.0` at `7b3a315`.
- GitHub release: https://github.com/newtc22222/ff-restaurent/releases/tag/v1.1.0
- Final verification source: `main` at
  `21fdd3997ffa640eba4835e1676ba4371bbd4b30`.
- Shipped database lineage: 17 migrations.
- Overall roadmap: In Progress; the immediate next milestone is Phase 2.5 - GCP
  Migration & Architecture Foundations. Phase 3 follows that stabilization
  boundary.

## Final production evidence

- Contract verification: run 29937704702, passed.
  - 17 completed migrations.
  - Phase 2 contract migration applied exactly once.
  - 0 restaurants without exactly one primary Cuisine.
  - 0 users without exactly one Favorites collection.
  - 1 Recommended collection.
  - 0 legacy restaurant columns and 0 `UserFavorite` tables.
- Authenticated deployment smoke: run 29937775099, passed after bounded
  cold-start retries.
- Snapshot-consistent recovery: run 29937777276, passed with exact dump/restore
  count equality:
  - Bill 3; BillAuditLog 12; BillParticipant 11.
  - Collection 9; CollectionRestaurant 14; CollectionShare 0.
  - Cuisine 22; RestaurantCuisine 13; RestaurantEntry 10;
    RestaurantPlatformLink 8.
  - RoleAuditLog 4; User 7; `_prisma_migrations` 17.

The first July 22 verification used the obsolete `a93b72ef` verifier, which
hard-coded `migrationCount === 14`. It failed only that metadata predicate after
the database had correctly advanced to 17 migrations; every normalized data and
schema-removal invariant was already valid. Run 29937704702 used the corrected
named-migration check and passed.

## Contracts to preserve

- Collections are the sole Favorites and Recommended persistence authority.
- `RestaurantCuisine` relations are the sole cuisine authority; each restaurant
  has exactly one primary Cuisine.
- Compatibility fields (`cuisineType`, `isRecommended`, `isFavoritedByMe`, and
  `isFavorite`) are derived at the API boundary, not restored as legacy storage.
- Production startup remains migrate -> phone normalize -> ROOT_ADMIN bootstrap
  -> `exec node dist/server.js`.
- Recovery counts must come from the same exported snapshot as the dump.

## Resume here

For new work, verify current Git and Linear state, select the next unblocked
Phase 2.5 ticket, and branch from the latest `origin/develop`. Do not reopen
Phase 2 or restore its removed schema unless a production regression is
demonstrated. Phase 3 work starts only after the Phase 2.5 migration and
architecture foundations are complete.
