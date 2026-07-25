# FF RESTaurent — Database Migration Playbook

## Render PostgreSQL → Google Cloud SQL for PostgreSQL

---

## Table of Contents

1. [Current Database Inventory](#1-current-database-inventory)
2. [Migration Strategy Decision](#2-migration-strategy-decision)
3. [Cloud SQL Instance Provisioning](#3-cloud-sql-instance-provisioning)
4. [Pre-Migration Preparation](#4-pre-migration-preparation)
5. [Migration Execution](#5-migration-execution)
6. [Post-Migration Verification](#6-post-migration-verification)
7. [Cutover & Connection Switchover](#7-cutover--connection-switchover)
8. [Rollback Procedure](#8-rollback-procedure)
9. [Ongoing Operations on Cloud SQL](#9-ongoing-operations-on-cloud-sql)

---

## 1. Current Database Inventory

### 1.1 Schema Overview

The database is defined in `apps/api/prisma/schema.prisma` and managed exclusively through Prisma ORM.

| Category | Count | Details |
| :--- | :---: | :--- |
| **Enums** | 7 | `ChefRole`, `SystemRole`, `PasswordResetStatus`, `EntryStatus`, `PaymentStatus`, `AdjustmentAllocation`, `RestaurantPlatform`, `CollectionSystemType` |
| **Models (Tables)** | 20 | See model inventory below |
| **Composite Indexes** | 30+ | Performance indexes on all query-hot paths |
| **Unique Constraints** | 12+ | Including `User.username`, `User.phone`, `User.systemRole`, `Cuisine.nameKey`, etc. |

### 1.2 Model Inventory

| Model | Primary Key | Notable Constraints |
| :--- | :--- | :--- |
| `User` | `id` (CUID) | `username` UNIQUE, `phone` UNIQUE (nullable), `systemRole` UNIQUE (singleton ROOT_ADMIN) |
| `PasswordResetRequest` | `id` (CUID) | `activeKey` UNIQUE, indexes on `[status, createdAt]`, `[userId, createdAt]` |
| `RootAdminTransferAudit` | `id` (CUID) | — |
| `RestaurantEntry` | `id` (CUID) | Indexes on `[diningAreaId]`, `[status, createdAt, id]`, `[createdById, createdAt, id]` |
| `Cuisine` | `id` (CUID) | `nameKey` UNIQUE |
| `RestaurantCuisine` | `[restaurantId, cuisineId]` | Composite PK, index on `[cuisineId]` |
| `DiningArea` | `id` (CUID) | `normalizedKey` UNIQUE |
| `RestaurantPlatformLink` | `id` (CUID) | UNIQUE on `[restaurantId, url]`, `[restaurantId, sortOrder]` |
| `Bill` | `id` (CUID) | Indexes on `[createdById, duplicateFingerprint, status]`, `[status, createdAt, id]`, etc. |
| `PaymentQrImage` | `id` (CUID) | `storagePath` UNIQUE, index on `[ownerId, status, createdAt, id]` |
| `BillParticipant` | `[billId, memberId]` | Composite PK, indexes on `[memberId, paymentStatus, billId]` |
| `Feedback` | `id` (CUID) | UNIQUE on `[billId, userId]`, `Decimal(3,1)` ratings |
| `ParticipantGroup` | `id` (CUID) | UNIQUE on `[ownerId, name]` |
| `ParticipantGroupMember` | `[groupId, userId]` | Composite PK |
| `Notification` | `id` (CUID) | Indexes on `[userId, createdAt, id]`, `[userId, readAt]`, `[billId, userId, createdAt]` |
| `RoleAuditLog` | `id` (CUID) | — |
| `BillAuditLog` | `id` (CUID) | Index on `[billId, createdAt, id]` |
| `Collection` | `id` (CUID) | Indexes on `[ownerId, createdAt]`, `[isPublic, createdAt]` |
| `CollectionShare` | `[collectionId, userId]` | Composite PK |
| `CollectionRestaurant` | `[collectionId, restaurantId]` | Composite PK |

### 1.3 Prisma Migration History

The project has **17 applied migrations** under `apps/api/prisma/migrations/`:

| # | Migration Name | Purpose |
| :---: | :--- | :--- |
| 1 | `20260708000000_init` | Initial schema: User, Bill, BillParticipant, RestaurantEntry, Notification, RoleAuditLog, BillAuditLog |
| 2 | `20260709000000_rename_cents_add_features` | Rename monetary columns, add features |
| 3 | `20260711000000_add_payment_url` | Add `paymentUrl` to Bill |
| 4 | `20260715133000_root_admin_governance` | SystemRole enum, RootAdminTransferAudit, singleton UNIQUE constraint |
| 5 | `20260715170000_password_reset_requests` | PasswordResetRequest model and related enums |
| 6 | `20260715190000_add_structured_restaurant_address` | Structured address fields on RestaurantEntry |
| 7 | `20260715220000_enrich_restaurant_profiles` | Banner images, phone, avatarUrl on restaurants |
| 8 | `20260715233000_add_cuisine_dining_area_catalogs` | Cuisine, DiningArea, RestaurantCuisine models |
| 9 | `20260715235500_add_shareable_collections` | Collection, CollectionShare, CollectionRestaurant models |
| 10 | `20260716003000_add_restaurant_feedback` | Feedback model with Decimal ratings |
| 11 | `20260716010000_add_notification_groups_duplicate_protection` | ParticipantGroup, ParticipantGroupMember, duplicate fingerprint |
| 12 | `20260716020000_add_search_pagination_indexes` | searchText fields and pagination indexes |
| 13 | `20260716030000_add_final_query_indexes` | Notification and BillAuditLog performance indexes |
| 14 | `20260716171458_drop_indexes` | Drop redundant/superseded indexes |
| 15 | `20260717090000_add_adjustment_allocation` | AdjustmentAllocation enum on Bill |
| 16 | `20260719090000_add_media_and_payment_qr` | PaymentQrImage model, Supabase storage integration |
| 17 | `20260720000000_contract_phase2_normalized_restaurants` | Phase 2 contract: drop legacy columns/tables |

### 1.4 Seed & Backfill Scripts

These scripts run as part of the container startup sequence in `docker-compose.yml` and `apps/api/Dockerfile`:

| Script | File | Behavior | Production Safe? |
| :--- | :--- | :--- | :---: |
| **Demo seed** | `prisma/seed-if-empty.ts` | Seeds demo users/restaurants/bills if DB is empty. **Throws in production.** | ❌ Never |
| **Cuisine catalog seed** | `prisma/seed-popular-cuisines.ts` | Idempotent upsert of popular Vietnamese cuisines | ✅ Yes |
| **Phone backfill** | `prisma/backfill-user-phones.ts` | Normalizes existing phone numbers to canonical E.164. Validates before applying. | ✅ Yes |
| **ROOT_ADMIN bootstrap** | `prisma/bootstrap-root-admin.ts` | Promotes `ROOT_ADMIN_USERNAME` to ROOT_ADMIN if none exists. Race-condition safe (P2002 catch). | ✅ Yes |
| **ROOT_ADMIN recovery** | `prisma/recover-root-admin.ts` | Interactive TTY script for emergency password reset. **Not automated.** | 🔧 Manual only |

### 1.5 Verification Scripts

| Script | File | Purpose |
| :--- | :--- | :--- |
| **Index verification** | `prisma/verify-final-query-indexes.ts` | Confirms 4 critical query indexes exist and are used by EXPLAIN plans |
| **Phase 2 contract verification** | `prisma/verify-phase2-contract.ts` | Validates normalized restaurants, cuisines, collections, and legacy column removal |
| **Backup restore drill** | `scripts/backup-restore-drill.sh` | Weekly pg_dump + pg_restore round-trip with row-count validation |

---

## 2. Migration Strategy Decision

### Approach: Full Logical Dump & Restore

We use `pg_dump` / `pg_restore` (custom format) for the data transfer. This is the correct approach because:

1. **Render does not expose physical replication** — logical replication or streaming replication is not available on Render's managed PostgreSQL.
2. **Dataset size is small** — this is a team-internal bill-splitting app; the data volume is well within logical dump/restore performance limits.
3. **Prisma migration state must be preserved** — the `_prisma_migrations` table must transfer intact so that `prisma migrate deploy` on Cloud SQL recognizes all 17 migrations as already applied.
4. **Existing tooling** — the project already has a tested `scripts/backup-restore-drill.sh` that performs exactly this round-trip and validates row counts.

### Migration Window

> **WARNING**: Downtime required. Because we cannot set up real-time replication between Render and Cloud SQL, there will be a write-freeze window during which:
> 1. The Render API is stopped (or put in read-only mode).
> 2. A final dump is taken.
> 3. The dump is restored to Cloud SQL.
> 4. The Cloud Run API is brought online pointing to Cloud SQL.
>
> **Estimated window: 15–30 minutes** for a small dataset.

---

## 3. Cloud SQL Instance Provisioning

### 3.1 Create the Instance

```bash
# Set project context
gcloud config set project ff-restaurent-prod

# Create Cloud SQL instance
gcloud sql instances create ff-restaurent-db \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=asia-east1 \
  --storage-size=10GB \
  --storage-auto-increase \
  --backup-start-time=03:00 \
  --availability-type=zonal \
  --maintenance-window-day=SUN \
  --maintenance-window-hour=4 \
  --database-flags=log_min_duration_statement=1000 \
  --deletion-protection
```

### 3.2 Create the Database and User

```bash
# Create the application database
gcloud sql databases create ff_restaurent \
  --instance=ff-restaurent-db \
  --charset=UTF8

# Create the application user
gcloud sql users create ff \
  --instance=ff-restaurent-db \
  --password="$(openssl rand -base64 32)"
```

> **IMPORTANT**: Record the generated password securely. This will be used in the `DATABASE_URL` stored in GCP Secret Manager.

### 3.3 Network & Connectivity

Cloud Run connects to Cloud SQL via the **Cloud SQL Auth Proxy** sidecar (built into Cloud Run's `--add-cloudsql-instances` flag). This means:

- **No public IP required on Cloud SQL** — use private IP or the Auth Proxy socket.
- **No VPC connector required** for basic setups.
- **SSL is enforced transparently** by the Auth Proxy.

```bash
# Get the Cloud SQL connection name (needed for Cloud Run)
gcloud sql instances describe ff-restaurent-db --format='value(connectionName)'
# Output: ff-restaurent-prod:asia-east1:ff-restaurent-db
```

The `DATABASE_URL` for Cloud Run with Auth Proxy uses Unix socket format:

```
postgresql://ff:<PASSWORD>@localhost/ff_restaurent?host=/cloudsql/ff-restaurent-prod:asia-east1:ff-restaurent-db&schema=public
```

Or, for direct connection (if public IP is enabled temporarily for the initial data import):

```
postgresql://ff:<PASSWORD>@<CLOUD_SQL_PUBLIC_IP>:5432/ff_restaurent?schema=public&sslmode=require
```

---

## 4. Pre-Migration Preparation

### 4.1 Pre-Flight Checklist

- [ ] Cloud SQL instance is running and accessible.
- [ ] Application user `ff` is created with the correct password.
- [ ] Database `ff_restaurent` exists on the Cloud SQL instance.
- [ ] `pg_dump` (v16+) and `pg_restore` (v16+) are installed on the operator machine.
- [ ] Render database credentials are available (`DATABASE_URL` from Render dashboard).
- [ ] GCP Secret Manager secrets are created (placeholder values OK at this stage).
- [ ] Cloud Run API service is **not yet deployed** or is pointing to the old database.
- [ ] A communication plan is sent to all team members about the maintenance window.

### 4.2 Take a Pre-Migration Backup on Render

Before touching anything, capture a full backup and row counts from the current production database:

```bash
# Export environment
export RENDER_DB_URL="postgresql://<USER>:<PASS>@<RENDER_HOST>:5432/ff_restaurent"

# Full custom-format dump
pg_dump "$RENDER_DB_URL" \
  --format=custom \
  --no-owner \
  --no-acl \
  --verbose \
  --file=ff_restaurent_pre_migration.dump

# Capture row counts for every table (for later verification)
psql "$RENDER_DB_URL" --no-align --tuples-only --quiet <<'SQL' > source_row_counts.txt
SELECT format(
  'SELECT %L AS table_name, COUNT(*)::bigint AS row_count FROM %I.%I',
  tablename, schemaname, tablename
)
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename
\gexec
SQL

echo "=== Source row counts ==="
cat source_row_counts.txt
```

### 4.3 Validate Prisma Migration State on Render

Confirm that all 17 migrations have been applied and none are rolled back:

```bash
psql "$RENDER_DB_URL" --set ON_ERROR_STOP=1 <<'SQL'
SELECT migration_name, finished_at, rolled_back_at
FROM "_prisma_migrations"
ORDER BY started_at;

SELECT COUNT(*) AS total_applied
FROM "_prisma_migrations"
WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;
SQL
```

> **CAUTION**: Expected output: **17 applied migrations**, all with `finished_at IS NOT NULL` and `rolled_back_at IS NULL`. If any migration is incomplete or rolled back, resolve this on Render **before** proceeding.

### 4.4 Run Existing Verification Scripts Against Render

```bash
# From repository root, with DATABASE_URL pointing to Render
export DATABASE_URL="$RENDER_DB_URL"

# Verify indexes are present and used
npm run prisma:indexes:verify -w @ff-restaurent/api

# Verify Phase 2 contract
npm run prisma:phase2:contract:verify -w @ff-restaurent/api
```

Both scripts must pass cleanly. Their outputs serve as the **baseline** for post-migration comparison.

---

## 5. Migration Execution

### 5.1 Enter Maintenance Window

**Step 1: Stop Render API writes.**

Suspend or scale down the Render API service from the Render dashboard. This prevents any new writes during the dump.

**Step 2: Take the final production dump.**

```bash
# Final dump (during write-freeze)
pg_dump "$RENDER_DB_URL" \
  --format=custom \
  --no-owner \
  --no-acl \
  --verbose \
  --file=ff_restaurent_final.dump

# Final row counts
psql "$RENDER_DB_URL" --no-align --tuples-only --quiet <<'SQL' > source_final_counts.txt
SELECT format(
  'SELECT %L AS table_name, COUNT(*)::bigint AS row_count FROM %I.%I',
  tablename, schemaname, tablename
)
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename
\gexec
SQL
```

### 5.2 Import Into Cloud SQL

**Option A: Direct connection (temporary public IP)**

```bash
# Enable public IP temporarily for import
gcloud sql instances patch ff-restaurent-db \
  --assign-ip

export CLOUD_SQL_URL="postgresql://ff:<PASSWORD>@<CLOUD_SQL_IP>:5432/ff_restaurent?sslmode=require"

# Clean the target database
psql "$CLOUD_SQL_URL" --set ON_ERROR_STOP=1 <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
SQL

# Restore the dump
pg_restore \
  --no-owner \
  --no-acl \
  --exit-on-error \
  --verbose \
  --dbname="$CLOUD_SQL_URL" \
  ff_restaurent_final.dump
```

**Option B: Cloud SQL Auth Proxy (no public IP)**

```bash
# Start the Cloud SQL Auth Proxy in a separate terminal
cloud-sql-proxy ff-restaurent-prod:asia-east1:ff-restaurent-db \
  --port=5433

# In the main terminal
export CLOUD_SQL_URL="postgresql://ff:<PASSWORD>@127.0.0.1:5433/ff_restaurent?schema=public"

psql "$CLOUD_SQL_URL" --set ON_ERROR_STOP=1 <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
SQL

pg_restore \
  --no-owner \
  --no-acl \
  --exit-on-error \
  --verbose \
  --dbname="$CLOUD_SQL_URL" \
  ff_restaurent_final.dump
```

**Step 3: Disable public IP after import (if Option A was used).**

```bash
gcloud sql instances patch ff-restaurent-db \
  --no-assign-ip
```

---

## 6. Post-Migration Verification

### 6.1 Row Count Comparison

```bash
# Capture restored row counts
psql "$CLOUD_SQL_URL" --no-align --tuples-only --quiet <<'SQL' > restored_counts.txt
SELECT format(
  'SELECT %L AS table_name, COUNT(*)::bigint AS row_count FROM %I.%I',
  tablename, schemaname, tablename
)
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename
\gexec
SQL

# Compare
diff --unified source_final_counts.txt restored_counts.txt
```

> **CAUTION**: The diff must be empty. Any row count discrepancy means data was lost during restore. Do not proceed until resolved.

### 6.2 Prisma Migration State

```bash
psql "$CLOUD_SQL_URL" --set ON_ERROR_STOP=1 <<'SQL'
-- Must show 17 successfully applied migrations
SELECT migration_name, finished_at, rolled_back_at
FROM "_prisma_migrations"
ORDER BY started_at;

SELECT COUNT(*) AS total_applied
FROM "_prisma_migrations"
WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;
SQL
```

### 6.3 Run Verification Scripts Against Cloud SQL

```bash
export DATABASE_URL="$CLOUD_SQL_URL"

# Index verification
npm run prisma:indexes:verify -w @ff-restaurent/api
# Expected: "FF-27 index coverage: 4/4"

# Phase 2 contract verification
npm run prisma:phase2:contract:verify -w @ff-restaurent/api
# Expected: "passed": true
```

### 6.4 Data Integrity Spot Checks

```bash
psql "$CLOUD_SQL_URL" --set ON_ERROR_STOP=1 <<'SQL'
-- Exactly one ROOT_ADMIN exists
SELECT COUNT(*) AS root_admin_count FROM "User" WHERE "systemRole" = 'ROOT_ADMIN';

-- All restaurants have exactly one primary cuisine
SELECT r.id, r.name, COUNT(rc."cuisineId") AS primary_count
FROM "RestaurantEntry" r
LEFT JOIN "RestaurantCuisine" rc ON rc."restaurantId" = r.id AND rc."isPrimary" = true
GROUP BY r.id, r.name
HAVING COUNT(rc."cuisineId") <> 1;
-- Expected: 0 rows

-- All monetary values are non-negative integers
SELECT COUNT(*) AS negative_costs
FROM "Bill"
WHERE "baseCost" < 0 OR "vat" < 0 OR "shippingFee" < 0 OR "totalCost" < 0;
-- Expected: 0

-- No orphaned participants
SELECT bp."billId", bp."memberId"
FROM "BillParticipant" bp
LEFT JOIN "Bill" b ON b.id = bp."billId"
LEFT JOIN "User" u ON u.id = bp."memberId"
WHERE b.id IS NULL OR u.id IS NULL;
-- Expected: 0 rows

-- Exactly one global Recommended collection
SELECT COUNT(*) FROM "Collection" WHERE "systemType" = 'RECOMMENDED';
-- Expected: 1

-- Enum values are valid
SELECT DISTINCT "chefRole" FROM "User" WHERE "chefRole" IS NOT NULL;
-- Expected: only 'SOUS_CHEF', 'HEAD_CHEF'

SELECT DISTINCT "status" FROM "Bill";
-- Expected: only 'ACTIVE', 'ARCHIVED'
SQL
```

### 6.5 Full Verification Summary

- [ ] Row counts match between Render dump and Cloud SQL restore.
- [ ] 17 Prisma migrations present, all with `finished_at`, no `rolled_back_at`.
- [ ] Index verification passes (4/4).
- [ ] Phase 2 contract verification passes.
- [ ] Exactly 1 ROOT_ADMIN user exists.
- [ ] All restaurants have exactly 1 primary cuisine.
- [ ] No negative monetary values.
- [ ] No orphaned bill participants.
- [ ] Exactly 1 Recommended collection.
- [ ] Enum values are within expected domains.

---

## 7. Cutover & Connection Switchover

### 7.1 Update DATABASE_URL in GCP Secret Manager

```bash
# Construct the Cloud Run Auth Proxy connection string
CLOUD_SQL_CONN="ff-restaurent-prod:asia-east1:ff-restaurent-db"
NEW_DB_URL="postgresql://ff:<PASSWORD>@localhost/ff_restaurent?host=/cloudsql/${CLOUD_SQL_CONN}&schema=public"

# Update the secret
echo -n "$NEW_DB_URL" | \
  gcloud secrets versions add DATABASE_URL --data-file=-
```

### 7.2 Deploy Cloud Run API With Cloud SQL Connector

```bash
gcloud run deploy ff-restaurent-api \
  --image=asia-east1-docker.pkg.dev/ff-restaurent-prod/ff-restaurent/api:v1.1.0 \
  --region=asia-east1 \
  --platform=managed \
  --port=4000 \
  --add-cloudsql-instances=ff-restaurent-prod:asia-east1:ff-restaurent-db \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,JWT_SECRET=JWT_SECRET:latest,REGISTRATION_INVITE_CODE=REGISTRATION_INVITE_CODE:latest,CORS_ORIGINS=CORS_ORIGINS:latest" \
  --set-env-vars="NODE_ENV=production,ROOT_ADMIN_USERNAME=<USERNAME>,API_PORT=4000" \
  --allow-unauthenticated
```

> **IMPORTANT**: The `--add-cloudsql-instances` flag automatically mounts the Cloud SQL Auth Proxy as a sidecar. The `DATABASE_URL` must use the `/cloudsql/CONNECTION_NAME` socket path format shown above.

### 7.3 Run Idempotent Post-Deploy Scripts

These are the same scripts that currently run at container startup. On Cloud Run, run them **once** as a Cloud Run Job or from a local terminal connected to Cloud SQL:

```bash
export DATABASE_URL="$NEW_DB_URL"

# 1. Apply any pending migrations (should be 0 if dump was clean)
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma

# 2. Idempotent seeds and backfills
npm run prisma:cuisines:seed -w @ff-restaurent/api
npm run prisma:phones:backfill -w @ff-restaurent/api
npm run prisma:root:bootstrap -w @ff-restaurent/api
```

### 7.4 Smoke Test the Live API

```bash
# Health check
curl -sf https://<CLOUD_RUN_API_URL>/health
# Expected: 200 OK

# Login test
curl -sf -X POST https://<CLOUD_RUN_API_URL>/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"<TEST_USER>","password":"<TEST_PASS>"}'
# Expected: 200 with JWT token
```

---

## 8. Rollback Procedure

### Scenario A: Pre-Cutover Rollback (Cloud Run not yet live)

Simply discard the Cloud SQL data and keep Render running. No user impact.

```bash
# Restart Render API service from dashboard
# Delete Cloud SQL data if desired:
psql "$CLOUD_SQL_URL" --set ON_ERROR_STOP=1 -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
```

### Scenario B: Post-Cutover Rollback (Cloud Run is live, issues detected)

```bash
# 1. Scale Cloud Run API to 0
gcloud run services update ff-restaurent-api --region=asia-east1 \
  --max-instances=0

# 2. Restart Render API service from the Render dashboard

# 3. Update DNS back to Render endpoints

# 4. Verify Render API health
curl -sf https://<RENDER_API_URL>/health
```

> **WARNING**: Any writes that occurred on Cloud SQL after cutover but before rollback will be **lost** unless manually reconciled. Minimize the rollback window.

### Scenario C: Data Corruption on Cloud SQL

```bash
# 1. Stop Cloud Run API
gcloud run services update ff-restaurent-api --region=asia-east1 --max-instances=0

# 2. Restore from the pre-migration dump or Cloud SQL automated backup
gcloud sql backups list --instance=ff-restaurent-db
gcloud sql backups restore <BACKUP_ID> --restore-instance=ff-restaurent-db

# 3. Re-verify with the verification suite
# 4. Redeploy Cloud Run API
```

---

## 9. Ongoing Operations on Cloud SQL

### 9.1 Automated Backups

Cloud SQL automated backups are configured at instance creation (`--backup-start-time=03:00`). Additionally:

- **Retention**: Configure via `gcloud sql instances patch --backup-retention-count=14`.
- **Point-in-time recovery**: Enable with `gcloud sql instances patch --enable-point-in-time-recovery`.

### 9.2 Adapt the Backup Restore Drill

The existing `backup-restore-drill.yml` workflow uses `DATABASE_URL` to dump from production. After migration:

1. Update the `PRODUCTION_DATABASE_URL` GitHub secret to the Cloud SQL connection string.
2. Consider running the drill through the Cloud SQL Auth Proxy (add proxy setup step to the workflow).
3. The drill script (`scripts/backup-restore-drill.sh`) needs no code changes — it is database-URL-agnostic.

### 9.3 Future Prisma Migrations on Cloud SQL

> **IMPORTANT**: Do not run migrations at container startup on Cloud Run. The current Dockerfile CMD (`apps/api/Dockerfile` line 24) runs `npx prisma migrate deploy` on boot. This is safe with a single container but dangerous when Cloud Run scales to multiple instances.

**Recommended approach:**

1. Run `prisma migrate deploy` as a **Cloud Run Job** or a **CI/CD pipeline step** before deploying the new Cloud Run revision.
2. Remove `npx prisma migrate deploy` from the Dockerfile `CMD`.
3. The Dockerfile `CMD` should only run:
   ```dockerfile
   CMD ["node", "dist/server.js"]
   ```

### 9.4 Monitoring & Alerts

Set up Cloud SQL monitoring for:

| Metric | Alert Threshold | Action |
| :--- | :--- | :--- |
| CPU utilization | > 80% sustained 5 min | Consider upgrading tier |
| Memory utilization | > 90% sustained 5 min | Consider upgrading tier |
| Storage utilization | > 80% | Verify auto-increase is on |
| Connection count | > 80% of max | Check for connection leaks |
| Replication lag | > 30s (if HA) | Investigate Cloud SQL health |

```bash
# View current metrics
gcloud sql instances describe ff-restaurent-db \
  --format='table(settings.tier, settings.dataDiskSizeGb, state)'
```

### 9.5 Cost Optimization

| Scenario | Recommendation |
| :--- | :--- |
| Low traffic / development | Keep `db-f1-micro` (~$9/month) |
| Growing traffic | Upgrade to `db-g1-small` (~$26/month) |
| High availability needed | Add `--availability-type=regional` (doubles cost) |
| Automated backups storage | First 7 backups free; each additional ~$0.08/GB/month |

---

## Appendix A: Quick Reference Commands

```bash
# ---- Cloud SQL ----
# Connect interactively
gcloud sql connect ff-restaurent-db --user=ff --database=ff_restaurent

# List backups
gcloud sql backups list --instance=ff-restaurent-db

# Manual backup
gcloud sql backups create --instance=ff-restaurent-db --description="Pre-release backup"

# ---- Prisma ----
# Apply pending migrations (run BEFORE deploying new API revision)
DATABASE_URL="<CLOUD_SQL_URL>" npx prisma migrate deploy --schema apps/api/prisma/schema.prisma

# Check migration status
DATABASE_URL="<CLOUD_SQL_URL>" npx prisma migrate status --schema apps/api/prisma/schema.prisma

# ---- Verification ----
DATABASE_URL="<CLOUD_SQL_URL>" npm run prisma:indexes:verify -w @ff-restaurent/api
DATABASE_URL="<CLOUD_SQL_URL>" npm run prisma:phase2:contract:verify -w @ff-restaurent/api
```
