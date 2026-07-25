# FF RESTaurent 2.0.0

Release date: 2026-07-26

Release tag: `v2.0.0`

## Overview

Version 2.0.0 marks a major infrastructure shift for FF RESTaurent. The platform has successfully migrated from Render to a robust, scalable architecture on Google Cloud Platform (GCP) and Cloudflare. This release completes the Phase 2.5 infrastructure migration milestone (Linear issues FF-54 and FF-58).

## Highlights

- **Google Cloud Run API**: The Fastify REST API is now containerized and running on Google Cloud Run, providing auto-scaling, high availability, and improved performance.
- **Cloud SQL PostgreSQL 16**: The primary database has been successfully migrated to a managed Google Cloud SQL instance (PostgreSQL 16) with automated backups, point-in-time recovery (PITR), and deletion protection enabled.
- **Google Secret Manager**: All sensitive configuration variables (e.g., `DATABASE_URL`, `JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`) are now securely managed and injected via Google Secret Manager.
- **Cloudflare Web Frontend**: The Vite React single-page application is now served securely behind Cloudflare, ensuring optimal edge caching, DDoS protection, and fast asset delivery.
- **Custom Domains**: The frontend now lives at `https://app.ff-restaurent.com` and the backend API at `https://api.ff-restaurent.com`, with fully configured CORS rules enforcing the boundaries between them.

## GCP Migration Execution

The migration was carefully orchestrated to ensure no data loss and minimal downtime:

1. Production infrastructure was provisioned via repeatable bash scripts (`provision-gcp-foundation.sh`, `harden-production-gcp.sh`).
2. Cloud Run jobs were utilized to execute the 17 Prisma migrations, ensuring the Cloud SQL schema exactly mirrored the final Render state.
3. The authoritative final data snapshot was exported from WSL via `pg_dump` and successfully restored into the Cloud SQL instance using a `pg_restore`/`psql` data-only import over the Cloud SQL Auth Proxy.
4. The API was deployed to Cloud Run and verified to successfully connect to Cloud SQL. The `CORS_ORIGINS` environment variable was updated to explicitly allow `https://app.ff-restaurent.com`.
5. Post-migration end-to-end smoke testing confirmed that user authentication and JWT session validation were functioning correctly (returning HTTP 200 OK for valid logins) against the newly restored data.

## Next Steps

With the Phase 2.5 GCP migration now concluded, Render will be permanently retired. The next active goal within the Phase 2.5 milestone is the establishment of automated GitHub Actions CI/CD pipelines and a zero-cost Staging environment (Linear FF-70).
