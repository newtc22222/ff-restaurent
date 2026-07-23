# GCP Foundation Operations

FF-56 provisions the recovery-ready GCP foundation without deploying the FF
RESTaurent application, restoring production data, changing Render, or cutting
over traffic.

## Fixed inventory

| Resource               | Configuration                                                                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Project                | `ff-restaurent` (`192523226156`)                                                                                                              |
| Region                 | `asia-east1`                                                                                                                                  |
| Cloud SQL              | `ff-restaurent-db`, PostgreSQL 16 Enterprise, zonal `db-custom-1-3840`, 10 GB SSD with auto-grow                                              |
| Database               | `ff_restaurent`; application user `ff_app`                                                                                                    |
| Recovery               | Daily backup at 18:00 UTC, 14 retained backups, seven days of PITR logs, deletion protection                                                  |
| Database network       | Public IP with no authorized networks; Cloud SQL connector/Auth Proxy only                                                                    |
| Artifact Registry      | `asia-east1` Docker repository `ff-restaurent`                                                                                                |
| Runtime identity       | `ff-runtime@ff-restaurent.iam.gserviceaccount.com`                                                                                            |
| Deployment identity    | `github-deployer@ff-restaurent.iam.gserviceaccount.com`                                                                                       |
| Workload identity      | Pool `github-actions`, provider `ff-restaurent`, immutable repository/owner IDs, `main` subject                                               |
| Cloud Run placeholders | Private `ff-restaurent-api` and `ff-restaurent-web`, minimum zero and maximum one instance                                                    |
| Budget                 | VND 2,630,000 per month (approximately USD 100 at the July 23, 2026 market rate); actual alerts at 50%, 80%, and 100%, forecast alert at 100% |

The runtime identity has Cloud SQL Client at project scope and Secret Manager
access only on the eight application secrets. The deployment identity can
manage Cloud Run, write images, view Cloud SQL, and act as the runtime identity.
No user-managed service-account key is created.

## Secure apply

Create the WSL directory with mode `700` and the JSON file with mode `600`:

```text
/home/f1fine/.config/ff-restaurent/gcp-production-secrets.json
```

The JSON object must contain exactly `JWT_SECRET`,
`REGISTRATION_INVITE_CODE`, `ROOT_ADMIN_USERNAME`, `SUPABASE_URL`, and
`SUPABASE_SERVICE_ROLE_KEY`. Never paste these values into a shell command,
GitHub workflow, issue, evidence file, or chat transcript.

Preview the reconciliation without reading the secrets file or changing GCP:

```bash
bash scripts/provision-gcp-foundation.sh --plan
```

Apply the named foundation resources:

```bash
bash scripts/provision-gcp-foundation.sh --apply \
  --secrets-file /home/f1fine/.config/ff-restaurent/gcp-production-secrets.json
```

The script is safe to rerun. It validates the active account, project number,
billing account, file ownership boundary, and existing Cloud SQL safety
settings before reconciling resources. It does not print secret values.

## GitHub federation

The repository variables are:

- `GCP_PROJECT_ID=ff-restaurent`
- `GCP_REGION=asia-east1`
- `GCP_WORKLOAD_IDENTITY_PROVIDER=projects/192523226156/locations/global/workloadIdentityPools/github-actions/providers/ff-restaurent`
- `GCP_DEPLOY_SERVICE_ACCOUNT=github-deployer@ff-restaurent.iam.gserviceaccount.com`

The manual `GCP foundation verify` workflow requests an OIDC token and performs
read-only inventory checks with short-lived credentials. A temporary exact
feature-branch subject may be added for the first dry run, but it must be
removed immediately afterward; the durable binding is for `main` only.

## Boundaries

- The Cloud Run placeholders are private and use an official image pinned by
  digest. They contain no FF RESTaurent application or secret configuration.
- `ff-restaurent-api` carries the managed Cloud SQL connection attachment, but
  FF-57 owns the deployable application images and release jobs.
- FF-58 owns the snapshot-consistent Render-to-Cloud-SQL rehearsal.
- Budget notifications do not cap or automatically stop GCP spending.
