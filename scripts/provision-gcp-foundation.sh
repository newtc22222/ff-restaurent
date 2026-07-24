#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="ff-restaurent"
PROJECT_NUMBER="192523226156"
REGION="asia-east1"
EXPECTED_ACCOUNT="phi.vo.tech@gmail.com"
BILLING_ACCOUNT="01D2B2-BCD7E8-002699"
SQL_INSTANCE="ff-restaurent-db"
SQL_DATABASE="ff_restaurent"
SQL_USER="ff_app"
SQL_TIER="db-custom-1-3840"
ARTIFACT_REPOSITORY="ff-restaurent"
RUNTIME_SERVICE_ACCOUNT="ff-runtime@${PROJECT_ID}.iam.gserviceaccount.com"
DEPLOY_SERVICE_ACCOUNT="github-deployer@${PROJECT_ID}.iam.gserviceaccount.com"
WORKLOAD_POOL="github-actions"
WORKLOAD_PROVIDER="ff-restaurent"
GITHUB_REPOSITORY="newtc22222/ff-restaurent"
GITHUB_REPOSITORY_ID="1295364742"
GITHUB_OWNER_ID="64945902"
PLACEHOLDER_IMAGE="us-docker.pkg.dev/cloudrun/container/hello@sha256:65067ea5c18ca5433861c58673f1cb5d0b9ca4b0be3bf9081446359770bb81ad"
BUDGET_NAME="FF RESTaurent monthly"
BUDGET_AMOUNT_VND="2630000"
MODE=""
SECRETS_FILE=""
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

readonly REQUIRED_APIS=(
  run.googleapis.com
  sqladmin.googleapis.com
  artifactregistry.googleapis.com
  secretmanager.googleapis.com
  iamcredentials.googleapis.com
  sts.googleapis.com
  billingbudgets.googleapis.com
  logging.googleapis.com
  monitoring.googleapis.com
)

usage() {
  cat <<'EOF'
Usage:
  bash scripts/provision-gcp-foundation.sh --plan
  bash scripts/provision-gcp-foundation.sh --apply --secrets-file /secure/path/gcp-production-secrets.json

--plan is read-only. --apply provisions only the named FF-56 foundation resources.
Secret values are never printed.
EOF
}

die() {
  printf 'FF-56 foundation error: %s\n' "$*" >&2
  exit 1
}

log() {
  printf '[ff-56] %s\n' "$*"
}

gcloud_cmd() {
  if [[ -n "${GCLOUD_BIN:-}" ]]; then
    "$GCLOUD_BIN" "$@"
    return
  fi

  if command -v gcloud >/dev/null 2>&1; then
    command gcloud "$@"
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

  die "gcloud is unavailable; install it or set GCLOUD_BIN"
}

resource_exists() {
  gcloud_cmd "$@" >/dev/null 2>&1
}

parse_args() {
  while (($#)); do
    case "$1" in
      --plan|--apply)
        [[ -z "$MODE" ]] || die "choose exactly one of --plan or --apply"
        MODE="${1#--}"
        ;;
      --secrets-file)
        shift
        (($#)) || die "--secrets-file requires a path"
        SECRETS_FILE="$1"
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
  if [[ "$MODE" == "apply" ]]; then
    [[ -n "$SECRETS_FILE" ]] || die "--apply requires --secrets-file"
  elif [[ -n "$SECRETS_FILE" ]]; then
    die "--secrets-file is only valid with --apply"
  fi
}

require_tools() {
  command -v python3 >/dev/null 2>&1 || die "python3 is required"
  command -v openssl >/dev/null 2>&1 || die "openssl is required"
  command -v sha256sum >/dev/null 2>&1 || die "sha256sum is required"
}

validate_cloud_context() {
  local account project_number billing_enabled billing_name
  account="$(gcloud_cmd config get-value account --quiet 2>/dev/null)"
  [[ "$account" == "$EXPECTED_ACCOUNT" ]] || die "active gcloud account must be ${EXPECTED_ACCOUNT}"

  project_number="$(gcloud_cmd projects describe "$PROJECT_ID" --format='value(projectNumber)' --quiet)"
  [[ "$project_number" == "$PROJECT_NUMBER" ]] || die "project number mismatch for ${PROJECT_ID}"

  read -r billing_enabled billing_name < <(
    gcloud_cmd billing projects describe "$PROJECT_ID" --format='value(billingEnabled,billingAccountName)' --quiet
  )
  [[ "$billing_enabled" == "True" ]] || die "billing is not enabled for ${PROJECT_ID}"
  [[ "$billing_name" == "billingAccounts/${BILLING_ACCOUNT}" ]] || die "unexpected billing account for ${PROJECT_ID}"
}

validate_secrets_file() {
  [[ -f "$SECRETS_FILE" ]] || die "secrets file does not exist"
  [[ ! -L "$SECRETS_FILE" ]] || die "secrets file must not be a symbolic link"

  local mode directory_mode
  mode="$(stat -c '%a' "$SECRETS_FILE")"
  directory_mode="$(stat -c '%a' "$(dirname "$SECRETS_FILE")")"
  [[ "$mode" == "600" ]] || die "secrets file mode must be 600"
  [[ "$directory_mode" == "700" ]] || die "secrets directory mode must be 700"

  python3 - "$SECRETS_FILE" <<'PY'
import json
import sys

path = sys.argv[1]
expected = {
    "JWT_SECRET",
    "REGISTRATION_INVITE_CODE",
    "ROOT_ADMIN_USERNAME",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
}
try:
    with open(path, encoding="utf-8") as stream:
        payload = json.load(stream)
except (OSError, json.JSONDecodeError) as error:
    raise SystemExit(f"invalid secrets JSON: {error}")
if not isinstance(payload, dict):
    raise SystemExit("secrets JSON must be an object")
actual = set(payload)
if actual != expected:
    missing = sorted(expected - actual)
    extra = sorted(actual - expected)
    raise SystemExit(f"secrets JSON keys do not match; missing={missing}, extra={extra}")
for key, value in payload.items():
    if not isinstance(value, str) or not value.strip():
        raise SystemExit(f"{key} must be a non-empty string")
if len(payload["JWT_SECRET"]) < 32:
    raise SystemExit("JWT_SECRET must contain at least 32 characters")
PY
}

read_input_secret() {
  local key="$1"
  python3 - "$SECRETS_FILE" "$key" <<'PY'
import json
import sys
with open(sys.argv[1], encoding="utf-8") as stream:
    print(json.load(stream)[sys.argv[2]], end="")
PY
}

ensure_api() {
  local api="$1"
  if gcloud_cmd services list --enabled --project "$PROJECT_ID" --filter="config.name=${api}" --format='value(config.name)' --quiet | grep -Fxq "$api"; then
    log "API enabled: ${api}"
  else
    log "Enabling API: ${api}"
    gcloud_cmd services enable "$api" --project "$PROJECT_ID" --quiet >/dev/null
  fi
}

ensure_service_account() {
  local email="$1" display_name="$2" account_id
  account_id="${email%@*}"
  if resource_exists iam service-accounts describe "$email" --project "$PROJECT_ID" --quiet; then
    log "Service account present: ${email}"
  else
    log "Creating service account: ${email}"
    gcloud_cmd iam service-accounts create "$account_id" --project "$PROJECT_ID" --display-name "$display_name" --quiet >/dev/null
  fi
}

ensure_project_role() {
  local member="$1" role="$2"
  if gcloud_cmd projects get-iam-policy "$PROJECT_ID" \
      --flatten='bindings[].members' \
      --filter="bindings.role=${role} AND bindings.members=${member}" \
      --format='value(bindings.role)' --quiet | grep -Fxq "$role"; then
    log "IAM present: ${member} -> ${role}"
  else
    log "Granting IAM: ${member} -> ${role}"
    gcloud_cmd projects add-iam-policy-binding "$PROJECT_ID" --member "$member" --role "$role" --quiet >/dev/null
  fi
}

ensure_service_account_role() {
  local service_account="$1" member="$2" role="$3"
  if gcloud_cmd iam service-accounts get-iam-policy "$service_account" \
      --project "$PROJECT_ID" \
      --flatten='bindings[].members' \
      --filter="bindings.role=${role} AND bindings.members=${member}" \
      --format='value(bindings.role)' --quiet | grep -Fxq "$role"; then
    log "Service-account IAM present: ${member} -> ${role}"
  else
    log "Granting service-account IAM: ${member} -> ${role}"
    gcloud_cmd iam service-accounts add-iam-policy-binding "$service_account" --project "$PROJECT_ID" --member "$member" --role "$role" --quiet >/dev/null
  fi
}

ensure_secret() {
  local secret_name="$1" value="$2" desired_hash current_hash=""
  if resource_exists secrets describe "$secret_name" --project "$PROJECT_ID" --quiet; then
    log "Secret resource present: ${secret_name}"
    current_hash="$(
      gcloud_cmd secrets versions access latest --secret "$secret_name" --project "$PROJECT_ID" --quiet 2>/dev/null \
        | sha256sum \
        | cut -d' ' -f1
    )"
  else
    log "Creating secret resource: ${secret_name}"
    gcloud_cmd secrets create "$secret_name" --project "$PROJECT_ID" --replication-policy=automatic --quiet >/dev/null
  fi

  desired_hash="$(printf '%s' "$value" | sha256sum | cut -d' ' -f1)"
  if [[ "$current_hash" == "$desired_hash" ]]; then
    log "Secret value current: ${secret_name}"
  else
    log "Adding secret version: ${secret_name}"
    printf '%s' "$value" | gcloud_cmd secrets versions add "$secret_name" --project "$PROJECT_ID" --data-file=- --quiet >/dev/null
  fi
}

ensure_secret_access() {
  local secret_name="$1" member="serviceAccount:${RUNTIME_SERVICE_ACCOUNT}"
  if gcloud_cmd secrets get-iam-policy "$secret_name" --project "$PROJECT_ID" \
      --flatten='bindings[].members' \
      --filter="bindings.role=roles/secretmanager.secretAccessor AND bindings.members=${member}" \
      --format='value(bindings.role)' --quiet | grep -Fxq 'roles/secretmanager.secretAccessor'; then
    log "Secret IAM present: ${secret_name}"
  else
    log "Granting runtime access to secret: ${secret_name}"
    gcloud_cmd secrets add-iam-policy-binding "$secret_name" --project "$PROJECT_ID" --member "$member" --role roles/secretmanager.secretAccessor --quiet >/dev/null
  fi
}

ensure_sql_instance() {
  if resource_exists sql instances describe "$SQL_INSTANCE" --project "$PROJECT_ID" --quiet; then
    local database_version tier region deletion_protection
    read -r database_version tier region deletion_protection < <(
      gcloud_cmd sql instances describe "$SQL_INSTANCE" --project "$PROJECT_ID" \
        --format='value(databaseVersion,settings.tier,region,settings.deletionProtectionEnabled)' --quiet
    )
    [[ "$database_version" == "POSTGRES_16" && "$tier" == "$SQL_TIER" && "$region" == "$REGION" && "$deletion_protection" == "True" ]] \
      || die "existing Cloud SQL instance has incompatible immutable or safety settings"
    log "Cloud SQL instance present: ${SQL_INSTANCE}"
  else
    log "Creating Cloud SQL PostgreSQL 16 instance: ${SQL_INSTANCE}"
    gcloud_cmd sql instances create "$SQL_INSTANCE" \
      --project "$PROJECT_ID" \
      --database-version POSTGRES_16 \
      --edition enterprise \
      --region "$REGION" \
      --availability-type zonal \
      --tier "$SQL_TIER" \
      --storage-type SSD \
      --storage-size 10 \
      --storage-auto-increase \
      --backup-start-time 18:00 \
      --retained-backups-count 14 \
      --enable-point-in-time-recovery \
      --retained-transaction-log-days 7 \
      --deletion-protection \
      --assign-ip \
      --quiet >/dev/null
  fi

  gcloud_cmd sql instances patch "$SQL_INSTANCE" --project "$PROJECT_ID" \
    --clear-authorized-networks \
    --backup-start-time 18:00 \
    --retained-backups-count 14 \
    --enable-point-in-time-recovery \
    --retained-transaction-log-days 7 \
    --storage-auto-increase \
    --deletion-protection \
    --quiet >/dev/null
}

ensure_database_and_user() {
  local db_password="$1"
  if ! resource_exists sql databases describe "$SQL_DATABASE" --instance "$SQL_INSTANCE" --project "$PROJECT_ID" --quiet; then
    log "Creating application database: ${SQL_DATABASE}"
    gcloud_cmd sql databases create "$SQL_DATABASE" --instance "$SQL_INSTANCE" --project "$PROJECT_ID" --quiet >/dev/null
  else
    log "Application database present: ${SQL_DATABASE}"
  fi

  if gcloud_cmd sql users list --instance "$SQL_INSTANCE" --project "$PROJECT_ID" --filter="name=${SQL_USER}" --format='value(name)' --quiet | grep -Fxq "$SQL_USER"; then
    log "Updating application database user password"
    gcloud_cmd sql users set-password "$SQL_USER" --instance "$SQL_INSTANCE" --project "$PROJECT_ID" --password "$db_password" --quiet >/dev/null
  else
    log "Creating application database user"
    gcloud_cmd sql users create "$SQL_USER" --instance "$SQL_INSTANCE" --project "$PROJECT_ID" --password "$db_password" --quiet >/dev/null
  fi
}

ensure_artifact_repository() {
  if resource_exists artifacts repositories describe "$ARTIFACT_REPOSITORY" --project "$PROJECT_ID" --location "$REGION" --quiet; then
    log "Artifact Registry repository present: ${ARTIFACT_REPOSITORY}"
  else
    log "Creating Artifact Registry repository: ${ARTIFACT_REPOSITORY}"
    gcloud_cmd artifacts repositories create "$ARTIFACT_REPOSITORY" --project "$PROJECT_ID" --location "$REGION" --repository-format docker --description 'FF RESTaurent container images' --quiet >/dev/null
  fi
}

ensure_wif() {
  if ! resource_exists iam workload-identity-pools describe "$WORKLOAD_POOL" --project "$PROJECT_ID" --location global --quiet; then
    log "Creating Workload Identity Pool: ${WORKLOAD_POOL}"
    gcloud_cmd iam workload-identity-pools create "$WORKLOAD_POOL" --project "$PROJECT_ID" --location global --display-name 'GitHub Actions' --quiet >/dev/null
  else
    log "Workload Identity Pool present: ${WORKLOAD_POOL}"
  fi

  if ! resource_exists iam workload-identity-pools providers describe "$WORKLOAD_PROVIDER" --project "$PROJECT_ID" --location global --workload-identity-pool "$WORKLOAD_POOL" --quiet; then
    log "Creating GitHub OIDC provider: ${WORKLOAD_PROVIDER}"
    gcloud_cmd iam workload-identity-pools providers create-oidc "$WORKLOAD_PROVIDER" \
      --project "$PROJECT_ID" \
      --location global \
      --workload-identity-pool "$WORKLOAD_POOL" \
      --display-name 'FF RESTaurent GitHub Actions' \
      --issuer-uri 'https://token.actions.githubusercontent.com' \
      --attribute-mapping 'google.subject=assertion.sub,attribute.repository_id=assertion.repository_id,attribute.repository_owner_id=assertion.repository_owner_id,attribute.repository=assertion.repository,attribute.ref=assertion.ref' \
      --attribute-condition "assertion.repository_id == '${GITHUB_REPOSITORY_ID}' && assertion.repository_owner_id == '${GITHUB_OWNER_ID}'" \
      --quiet >/dev/null
  else
    log "GitHub OIDC provider present: ${WORKLOAD_PROVIDER}"
  fi

  local principal="principal://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${WORKLOAD_POOL}/subject/repo:${GITHUB_REPOSITORY}:ref:refs/heads/main"
  ensure_service_account_role "$DEPLOY_SERVICE_ACCOUNT" "$principal" roles/iam.workloadIdentityUser
}

ensure_cloud_run_service() {
  local service="$1" cloudsql_flag=() connection_name="" expected_cloudsql="" current_image current_service_account current_max current_cloudsql
  if [[ "$service" == "ff-restaurent-api" ]]; then
    connection_name="$(gcloud_cmd sql instances describe "$SQL_INSTANCE" --project "$PROJECT_ID" --format='value(connectionName)' --quiet)"
    cloudsql_flag=(--add-cloudsql-instances "$connection_name")
    expected_cloudsql="$connection_name"
  fi

  if resource_exists run services describe "$service" --project "$PROJECT_ID" --region "$REGION" --quiet; then
    IFS='|' read -r current_image current_service_account current_max current_cloudsql < <(
      gcloud_cmd run services describe "$service" --project "$PROJECT_ID" --region "$REGION" \
        --format=json --quiet \
        | python3 -c 'import json,sys; d=json.load(sys.stdin); t=d["spec"]["template"]; a=t.get("metadata",{}).get("annotations",{}); s=t["spec"]; print("|".join((s["containers"][0]["image"],s["serviceAccountName"],a.get("autoscaling.knative.dev/maxScale",""),a.get("run.googleapis.com/cloudsql-instances",""))))'
    )
    if [[ "$current_image" == "$PLACEHOLDER_IMAGE" \
      && "$current_service_account" == "$RUNTIME_SERVICE_ACCOUNT" \
      && "$current_max" == "1" \
      && "$current_cloudsql" == "$expected_cloudsql" ]]; then
      log "Private Cloud Run placeholder present: ${service}"
      return
    fi
  fi

  log "Reconciling private Cloud Run placeholder: ${service}"
  gcloud_cmd run deploy "$service" \
    --project "$PROJECT_ID" \
    --region "$REGION" \
    --platform managed \
    --image "$PLACEHOLDER_IMAGE" \
    --service-account "$RUNTIME_SERVICE_ACCOUNT" \
    --min-instances 0 \
    --max-instances 1 \
    --ingress all \
    --no-allow-unauthenticated \
    "${cloudsql_flag[@]}" \
    --quiet >/dev/null
}

ensure_budget() {
  local budget_resource budget_id
  budget_resource="$(
    gcloud_cmd billing budgets list --billing-account "$BILLING_ACCOUNT" --format=json --quiet \
      | python3 -c 'import json,sys; matches=[item["name"] for item in json.load(sys.stdin) if item.get("displayName")=="FF RESTaurent monthly"]; print(matches[0] if matches else "")'
  )"
  if [[ -n "$budget_resource" ]]; then
    budget_id="${budget_resource##*/}"
    log "Reconciling project budget: ${BUDGET_NAME}"
    gcloud_cmd billing budgets update "$budget_id" \
      --billing-account "$BILLING_ACCOUNT" \
      --budget-amount "$BUDGET_AMOUNT_VND" \
      --calendar-period month \
      --filter-projects "projects/${PROJECT_NUMBER}" \
      --quiet >/dev/null
  else
    log "Creating project budget: ${BUDGET_NAME}"
    gcloud_cmd billing budgets create \
      --billing-account "$BILLING_ACCOUNT" \
      --display-name "$BUDGET_NAME" \
      --budget-amount "$BUDGET_AMOUNT_VND" \
      --calendar-period month \
      --filter-projects "projects/${PROJECT_NUMBER}" \
      --threshold-rule percent=0.50 \
      --threshold-rule percent=0.80 \
      --threshold-rule percent=1.00 \
      --threshold-rule percent=1.00,basis=forecasted-spend \
      --quiet >/dev/null
  fi
}

print_plan() {
  local enabled
  enabled="$(gcloud_cmd services list --enabled --project "$PROJECT_ID" --format='value(config.name)' --quiet)"
  log "Read-only plan for ${PROJECT_ID} (${PROJECT_NUMBER}) in ${REGION}"
  for api in "${REQUIRED_APIS[@]}"; do
    if grep -Fxq "$api" <<<"$enabled"; then
      printf '  API %-38s enabled\n' "$api"
    else
      printf '  API %-38s create\n' "$api"
    fi
  done
  printf '%s\n' \
    "  Cloud SQL ${SQL_INSTANCE}: reconcile PostgreSQL 16 ${SQL_TIER}, zonal, 10 GB SSD, backup/PITR/deletion protection" \
    "  IAM: reconcile runtime/deployer service accounts and least-privilege bindings" \
    "  WIF: reconcile ${WORKLOAD_POOL}/${WORKLOAD_PROVIDER}, main branch only" \
    "  Artifact Registry: reconcile ${ARTIFACT_REPOSITORY}" \
    "  Cloud Run: reconcile private ff-restaurent-api and ff-restaurent-web placeholders" \
    "  Secret Manager: reconcile eight named secrets (values are not read in plan mode)" \
    "  Billing: reconcile VND 2,630,000 monthly budget (approximately USD 100) with 50/80/100 actual and 100 forecast thresholds"
}

apply_foundation() {
  local runtime_member="serviceAccount:${RUNTIME_SERVICE_ACCOUNT}"
  local deploy_member="serviceAccount:${DEPLOY_SERVICE_ACCOUNT}"
  local db_password connection_name encoded_password database_url web_url cors_origin

  for api in "${REQUIRED_APIS[@]}"; do ensure_api "$api"; done

  ensure_service_account "$RUNTIME_SERVICE_ACCOUNT" 'FF RESTaurent runtime'
  ensure_service_account "$DEPLOY_SERVICE_ACCOUNT" 'FF RESTaurent GitHub deployer'
  ensure_project_role "$runtime_member" roles/cloudsql.client
  ensure_project_role "$deploy_member" roles/run.admin
  ensure_project_role "$deploy_member" roles/artifactregistry.writer
  ensure_project_role "$deploy_member" roles/cloudsql.viewer
  ensure_service_account_role "$RUNTIME_SERVICE_ACCOUNT" "$deploy_member" roles/iam.serviceAccountUser

  ensure_sql_instance

  if resource_exists secrets versions access latest --secret ff-database-password --project "$PROJECT_ID" --quiet; then
    db_password="$(gcloud_cmd secrets versions access latest --secret ff-database-password --project "$PROJECT_ID" --quiet)"
  else
    db_password="$(openssl rand -base64 48 | tr -d '\n')"
  fi
  ensure_secret ff-database-password "$db_password"
  ensure_database_and_user "$db_password"

  ensure_artifact_repository
  ensure_wif
  ensure_cloud_run_service ff-restaurent-api
  ensure_cloud_run_service ff-restaurent-web

  connection_name="$(gcloud_cmd sql instances describe "$SQL_INSTANCE" --project "$PROJECT_ID" --format='value(connectionName)' --quiet)"
  encoded_password="$(python3 - "$db_password" <<'PY'
import sys
from urllib.parse import quote
print(quote(sys.argv[1], safe=""), end="")
PY
)"
  database_url="postgresql://${SQL_USER}:${encoded_password}@localhost/${SQL_DATABASE}?host=/cloudsql/${connection_name}"
  web_url="$(gcloud_cmd run services describe ff-restaurent-web --project "$PROJECT_ID" --region "$REGION" --format='value(status.url)' --quiet)"
  cors_origin="$web_url"

  ensure_secret ff-database-url "$database_url"
  ensure_secret ff-jwt-secret "$(read_input_secret JWT_SECRET)"
  ensure_secret ff-registration-invite-code "$(read_input_secret REGISTRATION_INVITE_CODE)"
  ensure_secret ff-root-admin-username "$(read_input_secret ROOT_ADMIN_USERNAME)"
  ensure_secret ff-cors-origins "$cors_origin"
  ensure_secret ff-supabase-url "$(read_input_secret SUPABASE_URL)"
  ensure_secret ff-supabase-service-role-key "$(read_input_secret SUPABASE_SERVICE_ROLE_KEY)"

  for secret_name in ff-database-url ff-database-password ff-jwt-secret ff-registration-invite-code ff-root-admin-username ff-cors-origins ff-supabase-url ff-supabase-service-role-key; do
    ensure_secret_access "$secret_name"
  done

  ensure_budget
  log "Foundation apply completed without production cutover"
}

main() {
  parse_args "$@"
  require_tools
  validate_cloud_context
  if [[ "$MODE" == "plan" ]]; then
    print_plan
    return
  fi
  validate_secrets_file
  apply_foundation
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
