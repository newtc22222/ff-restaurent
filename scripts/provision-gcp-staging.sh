#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="ff-restaurent"
REGION="asia-east1"
EXPECTED_ACCOUNT="phi.vo.tech@gmail.com"
SQL_INSTANCE="ff-restaurent-db"
SQL_STAGING_DATABASE="ff_restaurent_staging"
SQL_USER="ff_app"
RUNTIME_SERVICE_ACCOUNT="ff-runtime@${PROJECT_ID}.iam.gserviceaccount.com"
PLACEHOLDER_IMAGE="us-docker.pkg.dev/cloudrun/container/hello@sha256:65067ea5c18ca5433861c58673f1cb5d0b9ca4b0be3bf9081446359770bb81ad"

STAGING_API_SERVICE="ff-restaurent-api-staging"
STAGING_WEB_SERVICE="ff-restaurent-web-staging"
STAGING_RELEASE_JOB="ff-restaurent-release-staging"

STAGING_DATABASE_SECRET="ff-staging-database-url"
STAGING_CORS_SECRET="ff-staging-cors-origins"
STAGING_ROOT_ADMIN_USERNAME_SECRET="ff-staging-root-admin-username"
STAGING_ROOT_ADMIN_PASSWORD_SECRET="ff-staging-root-admin-password"

STAGING_WEB_DOMAIN="${STAGING_WEB_DOMAIN:-staging.ff-restaurent.com}"
STAGING_API_DOMAIN="${STAGING_API_DOMAIN:-api-staging.ff-restaurent.com}"
STAGING_ROOT_ADMIN_USERNAME="${STAGING_ROOT_ADMIN_USERNAME:-f1fine}"
STAGING_ROOT_ADMIN_PASSWORD="${STAGING_ROOT_ADMIN_PASSWORD:-}"

MODE=""
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/provision-gcp-staging.sh --plan
  bash scripts/provision-gcp-staging.sh --apply

--plan is read-only.
--apply provisions the logical staging database, staging secrets, IAM grants, and placeholder staging Cloud Run services with --min-instances 0 (scale to zero).
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
  log "  Cloud Run Services: Reconcile placeholders '${STAGING_API_SERVICE}' and '${STAGING_WEB_SERVICE}' with --min-instances 0 (scale to zero)"
  log "  Cloud Run Job: Reconcile placeholder '${STAGING_RELEASE_JOB}'"
}

ensure_secret_version() {
  local secret_name="$1" value="$2"
  local current_hash="" desired_hash=""
  desired_hash="$(printf '%s' "$value" | sha256sum | cut -d' ' -f1)"
  current_hash="$(
    gcloud_cmd secrets versions access latest --secret "$secret_name" --project "$PROJECT_ID" --quiet 2>/dev/null \
      | sha256sum \
      | cut -d' ' -f1 || true
  )"
  if [[ "$current_hash" != "$desired_hash" ]]; then
    printf '%s' "$value" | gcloud_cmd secrets versions add "$secret_name" --project "$PROJECT_ID" --data-file=- --quiet >/dev/null
    log "Updated secret version: ${secret_name}"
  else
    log "Secret version current: ${secret_name}"
  fi
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

  # Grant deploy service account impersonation and token creation rights on runtime service account
  local deploy_service_account="github-deployer@${PROJECT_ID}.iam.gserviceaccount.com"
  for role in roles/iam.serviceAccountUser roles/iam.serviceAccountTokenCreator; do
    gcloud_cmd iam service-accounts add-iam-policy-binding "$RUNTIME_SERVICE_ACCOUNT" \
      --member="serviceAccount:${deploy_service_account}" \
      --role="$role" \
      --project "$PROJECT_ID" \
      --quiet >/dev/null 2>&1 || true
  done

  # Populate staging root admin credentials
  ensure_secret_version "$STAGING_ROOT_ADMIN_USERNAME_SECRET" "$STAGING_ROOT_ADMIN_USERNAME"

  local root_password="$STAGING_ROOT_ADMIN_PASSWORD"
  if [[ -z "$root_password" ]]; then
    if resource_exists secrets versions access latest --secret="$STAGING_ROOT_ADMIN_PASSWORD_SECRET" --project="$PROJECT_ID" --quiet; then
      root_password="$(gcloud_cmd secrets versions access latest --secret="$STAGING_ROOT_ADMIN_PASSWORD_SECRET" --project="$PROJECT_ID" --quiet)"
    else
      root_password="$(openssl rand -base64 24)"
      log "Generated secure random password for staging root admin"
    fi
  fi
  ensure_secret_version "$STAGING_ROOT_ADMIN_PASSWORD_SECRET" "$root_password"
  ensure_secret_version "$STAGING_CORS_SECRET" "https://${STAGING_WEB_DOMAIN}"

  # Populate staging database URL with percent-encoded password
  local db_password connection_name encoded_password staging_db_url
  db_password="$(gcloud_cmd secrets versions access latest --secret=ff-database-password --project="$PROJECT_ID" --quiet 2>/dev/null || echo "")"
  if [[ -n "$db_password" ]]; then
    connection_name="$(gcloud_cmd sql instances describe "$SQL_INSTANCE" --project "$PROJECT_ID" --format='value(connectionName)' --quiet)"
    encoded_password="$(python3 - "$db_password" <<'PY'
import sys
from urllib.parse import quote
print(quote(sys.argv[1], safe=""), end="")
PY
)"
    staging_db_url="postgresql://${SQL_USER}:${encoded_password}@localhost/${SQL_STAGING_DATABASE}?host=/cloudsql/${connection_name}"
    ensure_secret_version "$STAGING_DATABASE_SECRET" "$staging_db_url"
  fi

  # Reconcile Cloud Run staging placeholders so `gcloud run services describe` succeeds before first CI deployment
  connection_name="$(gcloud_cmd sql instances describe "$SQL_INSTANCE" --project "$PROJECT_ID" --format='value(connectionName)' --quiet)"

  if ! resource_exists run services describe "$STAGING_API_SERVICE" --project "$PROJECT_ID" --region "$REGION" --quiet; then
    log "Reconciling private Cloud Run placeholder: ${STAGING_API_SERVICE}"
    gcloud_cmd run deploy "$STAGING_API_SERVICE" \
      --project "$PROJECT_ID" \
      --region "$REGION" \
      --platform managed \
      --image "$PLACEHOLDER_IMAGE" \
      --service-account "$RUNTIME_SERVICE_ACCOUNT" \
      --min-instances 0 \
      --max-instances 1 \
      --ingress all \
      --no-allow-unauthenticated \
      --add-cloudsql-instances "$connection_name" \
      --quiet >/dev/null
  else
    log "Cloud Run service present: ${STAGING_API_SERVICE}"
  fi

  if ! resource_exists run services describe "$STAGING_WEB_SERVICE" --project "$PROJECT_ID" --region "$REGION" --quiet; then
    log "Reconciling private Cloud Run placeholder: ${STAGING_WEB_SERVICE}"
    gcloud_cmd run deploy "$STAGING_WEB_SERVICE" \
      --project "$PROJECT_ID" \
      --region "$REGION" \
      --platform managed \
      --image "$PLACEHOLDER_IMAGE" \
      --service-account "$RUNTIME_SERVICE_ACCOUNT" \
      --min-instances 0 \
      --max-instances 1 \
      --ingress all \
      --no-allow-unauthenticated \
      --quiet >/dev/null
  else
    log "Cloud Run service present: ${STAGING_WEB_SERVICE}"
  fi

  if ! resource_exists run jobs describe "$STAGING_RELEASE_JOB" --project "$PROJECT_ID" --region "$REGION" --quiet; then
    log "Reconciling Cloud Run release job placeholder: ${STAGING_RELEASE_JOB}"
    gcloud_cmd run jobs create "$STAGING_RELEASE_JOB" \
      --project "$PROJECT_ID" \
      --region "$REGION" \
      --image "$PLACEHOLDER_IMAGE" \
      --service-account "$RUNTIME_SERVICE_ACCOUNT" \
      --set-cloudsql-instances "$connection_name" \
      --tasks 1 \
      --max-retries 0 \
      --task-timeout 30m \
      --quiet >/dev/null
  else
    log "Cloud Run job present: ${STAGING_RELEASE_JOB}"
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
