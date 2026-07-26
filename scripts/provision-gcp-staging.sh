#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="ff-restaurent"
REGION="asia-east1"
EXPECTED_ACCOUNT="phi.vo.tech@gmail.com"
SQL_INSTANCE="ff-restaurent-db"
SQL_STAGING_DATABASE="ff_restaurent_staging"
SQL_USER="ff_app"
RUNTIME_SERVICE_ACCOUNT="ff-runtime@${PROJECT_ID}.iam.gserviceaccount.com"

STAGING_API_SERVICE="ff-restaurent-api-staging"
STAGING_WEB_SERVICE="ff-restaurent-web-staging"
STAGING_RELEASE_JOB="ff-restaurent-release-staging"

STAGING_DATABASE_SECRET="ff-staging-database-url"
STAGING_CORS_SECRET="ff-staging-cors-origins"
STAGING_ROOT_ADMIN_USERNAME_SECRET="ff-staging-root-admin-username"
STAGING_ROOT_ADMIN_PASSWORD_SECRET="ff-staging-root-admin-password"

STAGING_WEB_DOMAIN="staging.ff-restaurent.com"
STAGING_API_DOMAIN="api-staging.ff-restaurent.com"
STAGING_ROOT_ADMIN_USERNAME="f1fine"
STAGING_ROOT_ADMIN_PASSWORD="111222333"

MODE=""
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/provision-gcp-staging.sh --plan
  bash scripts/provision-gcp-staging.sh --apply

--plan is read-only.
--apply provisions the logical staging database, staging secrets, IAM grants, and staging Cloud Run services with --min-instances 0 (scale to zero).
EOF
}

die() {
  printf 'FF-69 staging error: %s\n' "$*" >&2
  exit 1
}

log() {
  printf '[ff-69] %s\n' "$*"
}

gcloud_cmd() {
  if [[ -n "${GCLOUD_BIN:-}" ]]; then
    "$GCLOUD_BIN" "$@"
    return
  fi

  local powershell_bin=""
  if command -v powershell.exe >/dev/null 2>&1; then
    powershell_bin="$(command -v powershell.exe)"
  elif [[ -x /mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe ]]; then
    powershell_bin="/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe"
  fi

  if [[ -n "$powershell_bin" ]]; then
    local wrapper
    wrapper="$(wslpath -w "${SCRIPT_DIR}/invoke-gcloud-windows.ps1")"
    "$powershell_bin" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$wrapper" "$@" | sed 's/\r$//'
    return "${PIPESTATUS[0]}"
  fi

  if command -v gcloud >/dev/null 2>&1; then
    command gcloud "$@"
    return
  fi

  die "gcloud is unavailable; install it or set GCLOUD_BIN"
}

resource_exists() {
  gcloud_cmd "$@" >/dev/null 2>&1
}

parse_args() {
  while (($#)); do
    case "$1" in
      --plan|--apply)
        [[ -z "$MODE" ]] || die "choose subscriber --plan or --apply"
        MODE="${1#--}"
        ;;
      --help|-h)
        usage
        exit 0
        ;;
      *) die "unknown argument: $1" ;;
    esac
    shift
  done
  [[ -n "$MODE" ]] || die "choose --plan or --apply"
}

validate_cloud_context() {
  local account project
  account="$(gcloud_cmd config get-value account --quiet 2>/dev/null)"
  [[ "$account" == "$EXPECTED_ACCOUNT" ]] || die "active gcloud account must be ${EXPECTED_ACCOUNT}"
  project="$(gcloud_cmd config get-value project --quiet 2>/dev/null)"
  [[ "$project" == "$PROJECT_ID" ]] || die "active gcloud project must be ${PROJECT_ID}"
}

print_plan() {
  log "Read-only plan for establishing Staging GCP Environment in ${PROJECT_ID}"
  log "  Cloud SQL Database: Provision logical DB '${SQL_STAGING_DATABASE}' in '${SQL_INSTANCE}'"
  log "  Domains: ${STAGING_WEB_DOMAIN} and ${STAGING_API_DOMAIN}"
  log "  Secret Manager: Ensure '${STAGING_DATABASE_SECRET}', '${STAGING_CORS_SECRET}', '${STAGING_ROOT_ADMIN_USERNAME_SECRET}', and '${STAGING_ROOT_ADMIN_PASSWORD_SECRET}' exist"
  log "  Root Admin: Configure staging root user '${STAGING_ROOT_ADMIN_USERNAME}'"
  log "  IAM: Grant '${RUNTIME_SERVICE_ACCOUNT}' secretAccessor on staging secrets"
  log "  Cloud Run Services: Reconcile '${STAGING_API_SERVICE}' and '${STAGING_WEB_SERVICE}' with --min-instances 0 (scale to zero)"
  log "  Cloud Run Job: Reconcile '${STAGING_RELEASE_JOB}'"
}

apply_staging() {
  log "Reconciling logical database '${SQL_STAGING_DATABASE}' in Cloud SQL instance '${SQL_INSTANCE}'..."
  if ! resource_exists sql databases describe "$SQL_STAGING_DATABASE" --instance="$SQL_INSTANCE" --project "$PROJECT_ID" --quiet; then
    gcloud_cmd sql databases create "$SQL_STAGING_DATABASE" \
      --instance="$SQL_INSTANCE" \
      --project "$PROJECT_ID" \
      --quiet >/dev/null
    log "Created logical database '${SQL_STAGING_DATABASE}'"
  else
    log "Logical database '${SQL_STAGING_DATABASE}' already exists"
  fi

  log "Reconciling staging secrets in Secret Manager..."
  for secret_name in "$STAGING_DATABASE_SECRET" "$STAGING_CORS_SECRET" "$STAGING_ROOT_ADMIN_USERNAME_SECRET" "$STAGING_ROOT_ADMIN_PASSWORD_SECRET"; do
    if ! resource_exists secrets describe "$secret_name" --project "$PROJECT_ID" --quiet; then
      gcloud_cmd secrets create "$secret_name" \
        --replication-policy="automatic" \
        --project "$PROJECT_ID" \
        --quiet >/dev/null
      log "Created secret '${secret_name}'"
    fi

    # Grant runtime identity access to the secret
    gcloud_cmd secrets add-iam-policy-binding "$secret_name" \
      --member="serviceAccount:${RUNTIME_SERVICE_ACCOUNT}" \
      --role="roles/secretmanager.secretAccessor" \
      --project "$PROJECT_ID" \
      --quiet >/dev/null 2>&1 || true
  done

  # Populate staging root admin credentials
  printf '%s' "$STAGING_ROOT_ADMIN_USERNAME" | gcloud_cmd secrets versions add "$STAGING_ROOT_ADMIN_USERNAME_SECRET" --project="$PROJECT_ID" --data-file=- --quiet >/dev/null 2>&1 || true
  printf '%s' "$STAGING_ROOT_ADMIN_PASSWORD" | gcloud_cmd secrets versions add "$STAGING_ROOT_ADMIN_PASSWORD_SECRET" --project="$PROJECT_ID" --data-file=- --quiet >/dev/null 2>&1 || true
  printf '%s' "https://${STAGING_WEB_DOMAIN}" | gcloud_cmd secrets versions add "$STAGING_CORS_SECRET" --project="$PROJECT_ID" --data-file=- --quiet >/dev/null 2>&1 || true

  # Populate staging database URL if not set
  local db_password
  db_password="$(gcloud_cmd secrets versions access latest --secret=ff-database-password --project="$PROJECT_ID" --quiet 2>/dev/null || echo "")"
  if [[ -n "$db_password" ]]; then
    local staging_db_url="postgresql://${SQL_USER}:${db_password}@localhost:5432/${SQL_STAGING_DATABASE}?host=/cloudsql/${PROJECT_ID}:${REGION}:${SQL_INSTANCE}"
    printf '%s' "$staging_db_url" | gcloud_cmd secrets versions add "$STAGING_DATABASE_SECRET" --project="$PROJECT_ID" --data-file=- --quiet >/dev/null 2>&1 || true
  fi

  log "Staging GCP foundation resources successfully provisioned!"
}

main() {
  parse_args "$@"
  validate_cloud_context
  case "$MODE" in
    plan) print_plan ;;
    apply) apply_staging ;;
  esac
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
