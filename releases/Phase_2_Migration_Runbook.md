# Phase 2 contract verification runbook

The expand/backfill operations are retired after accepted production repeat run 29760632288. Do not run the removed backfill command after migration 14.

## Deployment gate

Migration `20260720000000_contract_phase2_normalized_restaurants` performs all
legacy-equivalence and normalized-invariant checks before dropping any schema.
Any failed precondition aborts the migration and blocks deployment.

The production container sequence remains:

1. `prisma migrate deploy`
2. user-phone normalization
3. ROOT_ADMIN bootstrap
4. `exec node dist/server.js`

## Post-deployment verification

Dispatch the `Phase 2 contract verification` workflow on the deployed `main`
SHA. It runs:

```bash
npm run prisma:phase2:contract:verify -w @ff-restaurent/api
```

Require `passed=true`, `migrationCount=14`, zero restaurants without exactly
one primary Cuisine, zero users without exactly one Favorites collection,
exactly one Recommended collection, and zero legacy columns/tables.

Then run authenticated `Staging smoke` and `Backup restore drill`. The restored
manifest must match the dump snapshot exactly and include 14 migrations. Record
all run IDs, counts, and the deployed SHA in `releases/Release_1-1-0.md` and
`.codex/PHASE_2_HANDOFF.md` before tagging.

## Failure response

Do not force or manually edit the migration. Preserve the failed logs, restore
the previous application if required, correct the normalized source data using
a reviewed one-off operation, repeat recovery/smoke gates, and redeploy the same
reviewed release lineage. Any unresolved failure blocks `v1.1.0`.
