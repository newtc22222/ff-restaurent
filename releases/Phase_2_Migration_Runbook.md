# Phase 2 expand/backfill/contract runbook

This runbook covers FF-38 for the backward-compatible `v1.1.0` release. The
current code remains in the **expand + dual-read/dual-write** state. Do not
remove `RestaurantEntry.cuisineType`, `links`, `isFavorite`, `isRecommended`,
or `UserFavorite` until the release candidate has completed its production
observation window and rollback evidence is retained.

## Required preflight evidence

1. Capture a PostgreSQL snapshot and the expected row counts from that same
   exported snapshot, following the Phase 1 recovery procedure.
2. Record the deployed application SHA and migration count.
3. Apply additive Prisma migrations.
4. Run the backfill in dry-run mode and retain its JSON report:

```bash
PHASE2_BACKFILL_DRY_RUN=1 \
PHASE2_BACKFILL_REPORT_PATH=artifacts/phase2-backfill-dry-run.json \
npm run prisma:phase2:backfill -w @ff-restaurent/api
```

The dry run must be reviewed for invalid banner/platform URLs, invalid legacy
link JSON, and normalized Cuisine collisions. Every exception must have an
operator disposition; the command never silently deletes or rewrites an
invalid value.

## Execute and verify

Run with an explicit report path. The process uses deterministic batches and
idempotent inserts/upserts, so rerunning the same command resumes safely after
an interruption.

```bash
PHASE2_BACKFILL_BATCH_SIZE=100 \
PHASE2_BACKFILL_REPORT_PATH=artifacts/phase2-backfill-applied.json \
npm run prisma:phase2:backfill -w @ff-restaurent/api
```

Retain these `pre` and `post` report fields in the release evidence:

| Count                                  | Pre | Post |
| -------------------------------------- | --: | ---: |
| Users                                  |     |      |
| Restaurants                            |     |      |
| Legacy favorites                       |     |      |
| Legacy recommended flags               |     |      |
| Legacy ownerless/global favorite flags |     |      |
| Cuisines                               |     |      |
| Primary Cuisine joins                  |     |      |
| Platform links                         |     |      |
| Favorites collections                  |     |      |
| Recommended collections                |     |      |
| Collection memberships                 |     |      |

The report must finish with all verification values below:

- `restaurantsWithoutPrimaryCuisine = 0`
- `usersWithoutFavorites = 0`
- `duplicateFavoritesOwners = 0`
- `recommendedCollections = 1`
- `passed = true`

Immediately rerun the applied command. The second report must still pass and
must show zero created Cuisines, primary joins, promoted banners, platform
links, default Collections, and memberships. This is the resumability and
idempotency proof.

## Smoke and count reconciliation

After the applied run:

1. Reconcile the report's unchanged user, restaurant, bill, and legacy
   favorite counts against the snapshot-consistent expected counts.
2. Sign in as Customer, Sous Chef, Head Chef, and ROOT_ADMIN.
3. Verify Favorites toggles update the private Favorites collection.
4. Verify only chefs can change Recommended membership.
5. Verify a private shared Collection disappears immediately after unsharing.
6. Verify every restaurant has exactly one primary Cuisine and existing bills
   still resolve their restaurant.
7. Run the staging smoke suite and a recovery restore against the retained
   snapshot.

## Rollback and recovery rehearsal

The preferred rollback before contract is to redeploy the prior compatible
application SHA; additive tables and dual-written legacy fields may remain.
If data restoration is required, restore the pre-backfill snapshot into a new
database, compare the snapshot-consistent counts, run health/authentication
smoke checks, and only then redirect traffic. Do not attempt an ad-hoc reverse
delete because banner promotion and normalized joins may contain valid new
production writes.

Record the restore target, snapshot identifier, expected/restored counts,
migration count, smoke result, and recovery time in the `v1.1.0` evidence.

## Contract gate

Contract migration is allowed only after the `v1.1.0-rc.1` observation window
completes, all exceptions are resolved or explicitly accepted, the applied and
repeat reports pass, and snapshot restore is rehearsed. The contract change is
a separate release operation; this FF-38 implementation intentionally does not
drop legacy data.
