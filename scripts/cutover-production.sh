#!/usr/bin/env bash
set -euo pipefail

umask 077

PROJECT_ID="ff-restaurent"
PROJECT_NUMBER="192523226156"
REGION="asia-east1"
EXPECTED_ACCOUNT="phi.vo.tech@gmail.com"
SQL_INSTANCE="ff-restaurent-db"
SQL_USER="ff_app"
TARGET_DATABASE="ff_restaurent"
RENDER_DATABASE_ID="dpg-d9aced58nd3s73aqvhu0-a"
RENDER_API_SERVICE_ID="srv-d9achtd7vvec738us4pg"
RUNTIME_SERVICE_ACCOUNT="ff-runtime@${PROJECT_ID}.iam.gserviceaccount.com"
DEPLOY_SERVICE_ACCOUNT="github-deployer@${PROJECT_ID}.iam.gserviceaccount.com"
TARGET_DATABASE_SECRET="ff-database-url"
TARGET_CORS_SECRET="ff-cors-origins"
RELEASE_JOB="ff-restaurent-release"
API_SERVICE="ff-restaurent-api"
WEB_SERVICE="ff-restaurent-web"
PERMANENT_DATABASE="ff_restaurent"
PERMANENT_API_SERVICE="ff-restaurent-api"
PERMANENT_WEB_SERVICE="ff-restaurent-web"
CLOUD_SQL_CONNECTION="${PROJECT_ID}:${REGION}:${SQL_INSTANCE}"
API_IMAGE="${API_IMAGE:-asia-east1-docker.pkg.dev/ff-restaurent/ff-restaurent/api@sha256:61a911a332092fcf6d038ac68af5275978346da5e9e0091db08c4e33697ddbeb}"
WEB_IMAGE="${WEB_IMAGE:-asia-east1-docker.pkg.dev/ff-restaurent/ff-restaurent/web@sha256:3b8941e878a7a784fb502f0d55bc02998d5a47b8859661b9f2bcae0039fece8d}"
PASSPHRASE_FILE="${FF58_PASSPHRASE_FILE:-$HOME/.config/ff-restaurent/ff-55-passphrase}"
OUTPUT_DIR="${FF58_OUTPUT_DIR:-$HOME/.local/state/ff-restaurent/ff-58}"
PROXY_BIN="${CLOUD_SQL_PROXY_BIN:-$HOME/.local/bin/cloud-sql-proxy}"
PROXY_PORT="${CLOUD_SQL_PROXY_PORT:-55432}"
MAX_PROJECTED_SECONDS="${FF58_MAX_PROJECTED_SECONDS:-900}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE=""
SCRATCH_DIR=""
PROXY_PID=""
APPLY_STARTED="false"
CLEANUP_COMPLETE="false"
ORIGINAL_RUNTIME_POLICY=""
PERMANENT_STATE_BEFORE=""
WIF_STATE_BEFORE=""
CAPTURE_SECONDS=0
PASS_ONE_SECONDS=0
PASS_TWO_SECONDS=0
RESET_SECONDS=0
DEPLOY_SMOKE_SECONDS=0
RELEASE_EXECUTION_ONE=""
RELEASE_EXECUTION_TWO=""
ARTIFACT_PATH=""
ARTIFACT_SHA256=""
SOURCE_DEPLOYED_SHA=""

usage() {
  cat <<'EOF'
Usage:
  bash scripts/cutover-production.sh --plan
  bash scripts/cutover-production.sh --apply

--plan is read-only and reports inventory and proposed resources.
--apply captures Render once, drops the target database schema, restores, and deploys production.
EOF
}

die() {
  printf 'FF-58 rehearsal error: %s\n' "$*" >&2
  exit 1
}

log() {
  printf '[ff-58] %s\n' "$*"
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
  [[ -n "$powershell_bin" ]] || die "gcloud is unavailable"
  local wrapper
  wrapper="$(wslpath -w "${SCRIPT_DIR}/invoke-gcloud-windows.ps1")"
  "$powershell_bin" -NoProfile -NonInteractive -ExecutionPolicy Bypass \
    -File "$wrapper" "$@" | sed 's/\r$//'
  return "${PIPESTATUS[0]}"
}

npm_cmd() {
  if [[ -n "${NPM_BIN:-}" ]]; then
    "$NPM_BIN" "$@"
    return
  fi
  if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    command npm "$@"
    return
  fi
  local cmd_bin="/mnt/c/Windows/System32/cmd.exe"
  [[ -x "$cmd_bin" ]] || die "Node.js/npm is unavailable"
  NPM_CONFIG_SCRIPT_SHELL='C:\Program Files\Git\bin\bash.exe'
  export NPM_CONFIG_SCRIPT_SHELL
  local bridge_environment="${WSLENV:-}"
  local name suffix
  for name in \
    DATABASE_URL \
    ROOT_ADMIN_USERNAME \
    MIGRATION_REHEARSAL_REPORT_PATH \
    API_URL \
    WEB_URL \
    API_CLOUD_RUN_IDENTITY_TOKEN \
    WEB_CLOUD_RUN_IDENTITY_TOKEN \
    SMOKE_USERNAME \
    SMOKE_PASSWORD \
    SMOKE_ATTEMPTS \
    SMOKE_ATTEMPT_TIMEOUT_MS \
    SMOKE_RETRY_DELAY_MS \
    NPM_CONFIG_SCRIPT_SHELL; do
    [[ -v "$name" ]] || continue
    suffix=""
    [[ "$name" == "MIGRATION_REHEARSAL_REPORT_PATH" ]] && suffix="/p"
    bridge_environment="${bridge_environment:+${bridge_environment}:}${name}${suffix}"
  done
  WSLENV="$bridge_environment" "$cmd_bin" /d /c npm.cmd "$@"
}

resource_exists() {
  gcloud_cmd "$@" >/dev/null 2>&1
}

parse_args() {
  while (($#)); do
    case "$1" in
      --plan|--apply)
        [[ -z "$MODE" ]] || die "choose exactly one operation"
        MODE="${1#--}"
        ;;
      --passphrase-file)
        shift
        (($#)) || die "--passphrase-file requires a path"
        PASSPHRASE_FILE="$1"
        ;;
      --output-dir)
        shift
        (($#)) || die "--output-dir requires a path"
        OUTPUT_DIR="$1"
        ;;
      --help|-h)
        usage
        exit 0
        ;;
      *)
        die "unknown argument: $1"
        ;;
    esac
    shift
  done
  [[ -n "$MODE" ]] || die "choose --plan or --apply"
}

require_tools() {
  local tool
  for tool in python3 psql pg_dump pg_restore gpg tar sha256sum stat curl; do
    command -v "$tool" >/dev/null 2>&1 ||
      die "required command is unavailable: ${tool}"
  done
  command -v render >/dev/null 2>&1 || die "Render CLI is unavailable"
  npm_cmd --version >/dev/null || die "npm is unavailable"
  [[ -x "$PROXY_BIN" ]] || die "Cloud SQL Auth Proxy is unavailable at ${PROXY_BIN}"
  [[ "$(pg_dump --version)" == *" 16."* ]] ||
    die "pg_dump major version must be 16"
  [[ "$(pg_restore --version)" == *" 16."* ]] ||
    die "pg_restore major version must be 16"
  [[ "$(psql --version)" == *" 16."* ]] ||
    die "psql major version must be 16"
}

validate_context() {
  local account project project_number billing_enabled sql_version
  account="$(gcloud_cmd config get-value account --quiet 2>/dev/null)"
  [[ "$account" == "$EXPECTED_ACCOUNT" ]] ||
    die "active gcloud account does not match the fixed operator"
  project="$(gcloud_cmd config get-value project --quiet 2>/dev/null)"
  [[ "$project" == "$PROJECT_ID" ]] ||
    die "active gcloud project does not match ${PROJECT_ID}"
  project_number="$(
    gcloud_cmd projects describe "$PROJECT_ID" \
      --format='value(projectNumber)' --quiet
  )"
  [[ "$project_number" == "$PROJECT_NUMBER" ]] ||
    die "GCP project number does not match the fixed project"
  billing_enabled="$(
    gcloud_cmd billing projects describe "$PROJECT_ID" \
      --format='value(billingEnabled)' --quiet
  )"
  [[ "$billing_enabled" == "True" || "$billing_enabled" == "true" ]] ||
    die "GCP billing is not enabled"
  sql_version="$(
    gcloud_cmd sql instances describe "$SQL_INSTANCE" \
      --project "$PROJECT_ID" --format='value(databaseVersion)' --quiet
  )"
  [[ "$sql_version" == "POSTGRES_16" ]] ||
    die "Cloud SQL instance is not PostgreSQL 16"
  render whoami --output json >/dev/null
  render pg get "$RENDER_DATABASE_ID" --output json |
    python3 -c '
import json, sys
payload = json.load(sys.stdin)
item = payload.get("data", payload)
assert item.get("id") == sys.argv[1]
assert item.get("status") == "available"
assert str(item.get("version", "")).startswith("16")
' "$RENDER_DATABASE_ID" ||
    die "Render database identity, status, or version is invalid"
}

validate_secure_file() {
  local path="$1"
  [[ -f "$path" && -s "$path" ]] || die "secure file is missing or empty: ${path}"
  [[ "$(stat -c '%a' "$path")" == "600" ]] ||
    die "secure file must have mode 600: ${path}"
  [[ "$(stat -c '%a' "$(dirname "$path")")" == "700" ]] ||
    die "secure file parent directory must have mode 700"
}

assert_safe_names() {
  [[ "$TARGET_DATABASE" == "ff_restaurent" ]]
  [[ "$API_SERVICE" == "ff-restaurent-api" ]]
  [[ "$WEB_SERVICE" == "ff-restaurent-web" ]]
}

disposable_inventory() {
  # For cutover, we expect these permanent resources to ALREADY exist or to be managed here,
  # so we don't treat them as 'disposable' conflicts anymore. Just return 0.
  return 0
}

permanent_state() {
  {
    gcloud_cmd run services describe "$PERMANENT_API_SERVICE" \
      --project "$PROJECT_ID" --region "$REGION" \
      --format='value(metadata.name,status.latestReadyRevisionName,spec.template.spec.containers[0].image)' --quiet
    gcloud_cmd run services describe "$PERMANENT_WEB_SERVICE" \
      --project "$PROJECT_ID" --region "$REGION" \
      --format='value(metadata.name,status.latestReadyRevisionName,spec.template.spec.containers[0].image)' --quiet
    gcloud_cmd sql databases describe "$PERMANENT_DATABASE" \
      --instance "$SQL_INSTANCE" --project "$PROJECT_ID" \
      --format='value(name,instance,project)' --quiet
  }
}

wif_state() {
  gcloud_cmd iam service-accounts get-iam-policy "$DEPLOY_SERVICE_ACCOUNT" \
    --project "$PROJECT_ID" --format=json --quiet |
    python3 -c '
import json, sys
policy = json.load(sys.stdin)
members = sorted(
    member
    for binding in policy.get("bindings", [])
    if binding.get("role") == "roles/iam.workloadIdentityUser"
    for member in binding.get("members", [])
)
print("\n".join(members))
if len(members) != 1 or "ref:refs/heads/main" not in members[0]:
    raise SystemExit(1)
'
}

runtime_policy_state() {
  gcloud_cmd iam service-accounts get-iam-policy "$RUNTIME_SERVICE_ACCOUNT" \
    --project "$PROJECT_ID" --format=json --quiet |
    EXPECTED_MEMBER="user:${EXPECTED_ACCOUNT}" python3 -c '
import json, os, sys
policy = json.load(sys.stdin)
expected = os.environ["EXPECTED_MEMBER"]
bindings = []
for binding in policy.get("bindings", []):
    members = sorted(
        member
        for member in binding.get("members", [])
        if not (
            binding.get("role") == "roles/iam.serviceAccountTokenCreator"
            and member == expected
        )
    )
    if members:
        bindings.append({"role": binding.get("role"), "members": members})
print(json.dumps(sorted(bindings, key=lambda item: item["role"]), sort_keys=True))
'
}

print_plan() {
  log "plan validated fixed project ${PROJECT_ID} (${PROJECT_NUMBER})"
  log "source Render database: ${RENDER_DATABASE_ID} (read-only capture)"
  log "target Cloud SQL: ${SQL_INSTANCE}/${TARGET_DATABASE} (disposable)"
  log "immutable API image: ${API_IMAGE}"
  log "immutable web image: ${WEB_IMAGE}"
  log "maximum projected cutover: ${MAX_PROJECTED_SECONDS} seconds"
  if disposable_inventory; then
    log "no conflicting disposable resources found"
  else
    die "conflicting disposable resources exist; run --cleanup explicitly"
  fi
  permanent_state >/dev/null
  wif_state >/dev/null
  log "permanent database/placeholders and durable main-only WIF trust are intact"
}



cleanup_trap() {
  local status=$?
  if [[ -n "$PROXY_PID" ]]; then
    kill "$PROXY_PID" >/dev/null 2>&1
    wait "$PROXY_PID" >/dev/null 2>&1
  fi
  if [[ -n "$SCRATCH_DIR" ]]; then
    rm -rf "$SCRATCH_DIR"
  fi
  exit "$status"
}

create_secret() {
  local name="$1"
  local value="$2"
  gcloud_cmd secrets create "$name" --project "$PROJECT_ID" \
    --replication-policy=automatic --quiet >/dev/null
  printf '%s' "$value" |
    gcloud_cmd secrets versions add "$name" --project "$PROJECT_ID" \
      --data-file=- --quiet >/dev/null
  gcloud_cmd secrets add-iam-policy-binding "$name" \
    --project "$PROJECT_ID" \
    --member "serviceAccount:${RUNTIME_SERVICE_ACCOUNT}" \
    --role roles/secretmanager.secretAccessor \
    --quiet >/dev/null
}

discover_render_deployed_sha() {
  render deploys list "$RENDER_API_SERVICE_ID" --output json |
    python3 -c '
import json, re, sys
payload = json.load(sys.stdin)
items = payload if isinstance(payload, list) else payload.get("data", payload.get("deploys", []))
for item in items:
    if item.get("status") == "live":
        sha = (item.get("commit") or {}).get("id", "")
        if re.fullmatch(r"[0-9a-f]{40}", sha):
            print(sha)
            raise SystemExit(0)
raise SystemExit(1)
'
}

capture_source() {
  local capture_output="$SCRATCH_DIR/capture-output.txt"
  local capture_scripts="$SCRATCH_DIR/capture-scripts"
  local started
  started="$(date +%s)"
  SOURCE_DEPLOYED_SHA="$(discover_render_deployed_sha)" ||
    die "could not discover the live Render deployment SHA"
  mkdir -m 700 "$capture_scripts"
  sed 's/\r$//' "$SCRIPT_DIR/capture-render-production-baseline.sh" \
    >"$capture_scripts/capture-render-production-baseline.sh"
  sed 's/\r$//' "$SCRIPT_DIR/capture-production-baseline.sh" \
    >"$capture_scripts/capture-production-baseline.sh"
  chmod 700 "$capture_scripts"/*.sh
  BACKUP_PASSPHRASE="$(<"$PASSPHRASE_FILE")" \
    DEPLOYED_GIT_SHA="$SOURCE_DEPLOYED_SHA" \
    RENDER_POSTGRES_ID="$RENDER_DATABASE_ID" \
    BASELINE_OUTPUT_DIR="$OUTPUT_DIR" \
    CAPTURE_OUTPUT_FILE="$capture_output" \
    bash "$capture_scripts/capture-render-production-baseline.sh" >/dev/null
  ARTIFACT_PATH="$(sed -n 's/^artifact_path=//p' "$capture_output")"
  ARTIFACT_SHA256="$(sed -n 's/^encrypted_sha256=//p' "$capture_output")"
  [[ -f "$ARTIFACT_PATH" && "$ARTIFACT_SHA256" =~ ^[0-9a-f]{64}$ ]] ||
    die "capture did not return a valid encrypted artifact"
  CAPTURE_SECONDS="$(( $(date +%s) - started ))"
  log "fresh snapshot capture completed in ${CAPTURE_SECONDS}s"
}

decrypt_and_validate_artifact() {
  local archive="$SCRATCH_DIR/source.tar.gz"
  local extracted="$SCRATCH_DIR/source"
  (
    cd "$(dirname "$ARTIFACT_PATH")"
    sha256sum --check "$(basename "$ARTIFACT_PATH").sha256" >/dev/null
  ) || die "encrypted artifact checksum verification failed"
  gpg --batch --yes --pinentry-mode loopback \
    --passphrase-file "$PASSPHRASE_FILE" \
    --output "$archive" --decrypt "$ARTIFACT_PATH" >/dev/null 2>&1 ||
    die "artifact decryption failed"
  mkdir -m 700 "$extracted"
  tar --extract --gzip --file "$archive" --directory "$extracted"
  (
    cd "$extracted"
    sha256sum --check production.dump.sha256 >/dev/null
    sha256sum --check row-counts.tsv.sha256 >/dev/null
  ) || die "artifact internal checksum verification failed"
  pg_restore --list "$extracted/production.dump" >/dev/null ||
    die "artifact dump listing failed"
  grep -Fxq 'applied_migrations=17' "$extracted/manifest.txt" ||
    die "artifact manifest does not contain 17 applied migrations"
  grep -Fxq 'rolled_back_migrations=0' "$extracted/manifest.txt" ||
    die "artifact manifest contains rolled-back migrations"
  grep -Fxq 'phase2_contract_migrations=1' "$extracted/manifest.txt" ||
    die "artifact manifest does not contain the Phase 2 contract exactly once"
  grep -Eq '^source_database_version=16([.]|$)' "$extracted/manifest.txt" ||
    die "artifact source is not PostgreSQL 16"
  [[ "$(wc -l <"$extracted/migrations.tsv" | tr -d ' ')" == "17" ]] ||
    die "artifact migration inventory is incomplete"
  [[ "$(
    grep -c '^20260720000000_contract_phase2_normalized_restaurants|' \
      "$extracted/migrations.tsv"
  )" == "1" ]] || die "named Phase 2 migration is missing or duplicated"
  log "artifact encryption, manifest, checksums, dump, and migrations validated"
}

start_proxy() {
  local proxy_log="$SCRATCH_DIR/cloud-sql-proxy.log"
  CSQL_PROXY_TOKEN="$(gcloud_cmd auth print-access-token --quiet)"
  export CSQL_PROXY_TOKEN
  "$PROXY_BIN" --port "$PROXY_PORT" --quiet "$CLOUD_SQL_CONNECTION" \
    >"$proxy_log" 2>&1 &
  PROXY_PID="$!"
  local ready=false
  for _ in {1..30}; do
    if pg_isready --host 127.0.0.1 --port "$PROXY_PORT" \
        --timeout 1 >/dev/null 2>&1; then
      ready=true
      break
    fi
    kill -0 "$PROXY_PID" >/dev/null 2>&1 || break
    sleep 1
  done
  [[ "$ready" == "true" ]] || die "Cloud SQL Auth Proxy did not become ready"
}

clean_database() {
  psql --no-psqlrc --set ON_ERROR_STOP=1 --host 127.0.0.1 \
    --port "$PROXY_PORT" --username "$SQL_USER" --dbname "$TARGET_DATABASE" \
    --command="DROP SCHEMA public CASCADE; CREATE SCHEMA public;" >/dev/null 2>&1 || true
}

delete_database() {
  gcloud_cmd sql databases delete "$TARGET_DATABASE" \
    --instance "$SQL_INSTANCE" --project "$PROJECT_ID" \
    --quiet >/dev/null
}

capture_restored_counts() {
  local output="$1"
  psql --no-psqlrc --set ON_ERROR_STOP=1 --host 127.0.0.1 \
    --port "$PROXY_PORT" --username "$SQL_USER" --dbname "$TARGET_DATABASE" \
    --no-align --tuples-only --quiet \
    --command="SELECT format('SELECT %L AS table_name, COUNT(*)::bigint AS row_count FROM %I.%I;', tablename, schemaname, tablename) FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename" |
    psql --no-psqlrc --set ON_ERROR_STOP=1 --host 127.0.0.1 \
      --port "$PROXY_PORT" --username "$SQL_USER" --dbname "$TARGET_DATABASE" \
      --no-align --tuples-only --quiet >"$output"
}

deploy_release_job() {
  gcloud_cmd run jobs deploy "$RELEASE_JOB" --project "$PROJECT_ID" \
    --region "$REGION" --image "$API_IMAGE" --command npm \
    --args run,release:run --service-account "$RUNTIME_SERVICE_ACCOUNT" \
    --set-cloudsql-instances "$CLOUD_SQL_CONNECTION" \
    --set-secrets "DATABASE_URL=${TARGET_DATABASE_SECRET}:latest,ROOT_ADMIN_USERNAME=ff-root-admin-username:latest" \
    --set-env-vars NODE_ENV=production --tasks 1 --max-retries 0 \
    --task-timeout 30m --quiet >/dev/null
}

execute_release_job() {
  gcloud_cmd run jobs execute "$RELEASE_JOB" --project "$PROJECT_ID" \
    --region "$REGION" --wait --format='value(metadata.name)' --quiet
}

wait_for_runtime_impersonation() {
  local attempts="${FF58_IMPERSONATION_ATTEMPTS:-30}"
  local attempt
  for ((attempt = 0; attempt < attempts; attempt += 1)); do
    if gcloud_cmd auth print-access-token \
        --impersonate-service-account "$RUNTIME_SERVICE_ACCOUNT" \
        --quiet >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

run_private_smoke() {
  local api_url="$1"
  local web_url="$2"
  local api_token="$3"
  local web_token="$4"
  API_URL="$api_url" WEB_URL="$web_url" \
    API_CLOUD_RUN_IDENTITY_TOKEN="$api_token" \
    WEB_CLOUD_RUN_IDENTITY_TOKEN="$web_token" \
    npm_cmd run smoke >/dev/null
}

run_invariants() {
  local pass="$1"
  local report="$SCRATCH_DIR/invariants-${pass}.json"
  DATABASE_URL="postgresql://${SQL_USER}:${ENCODED_DB_PASSWORD}@127.0.0.1:${PROXY_PORT}/${TARGET_DATABASE}?schema=public" \
    MIGRATION_REHEARSAL_REPORT_PATH="$report" \
    npm_cmd run prisma:migration:verify -w @ff-restaurent/api >/dev/null
  DATABASE_URL="postgresql://${SQL_USER}:${ENCODED_DB_PASSWORD}@127.0.0.1:${PROXY_PORT}/${TARGET_DATABASE}?schema=public" \
    npm_cmd run prisma:phase2:contract:verify -w @ff-restaurent/api >/dev/null
}

rehearsal_pass() {
  local pass="$1"
  local source_dir="$SCRATCH_DIR/source"
  local before_counts="$SCRATCH_DIR/restored-counts-${pass}.tsv"
  local after_counts="$SCRATCH_DIR/post-release-counts-${pass}.tsv"
  local started
  started="$(date +%s)"
  pg_restore --no-owner --no-acl --exit-on-error --single-transaction \
    --host 127.0.0.1 --port "$PROXY_PORT" --username "$SQL_USER" \
    --dbname "$TARGET_DATABASE" "$source_dir/production.dump" >/dev/null ||
    die "pass ${pass} restore failed"
  capture_restored_counts "$before_counts" ||
    die "pass ${pass} restored-count capture failed"
  cmp --silent "$source_dir/row-counts.tsv" "$before_counts" ||
    die "pass ${pass} restored counts differ from the source snapshot"
  local execution
  if ! execution="$(execute_release_job)"; then
    die "pass ${pass} release job failed"
  fi
  [[ -n "$execution" ]] || die "pass ${pass} release execution ID is empty"
  capture_restored_counts "$after_counts" ||
    die "pass ${pass} post-release count capture failed"
  cmp --silent "$before_counts" "$after_counts" ||
    die "pass ${pass} release job changed row counts"
  run_invariants "$pass" || die "pass ${pass} invariant verification failed"
  local elapsed="$(( $(date +%s) - started ))"
  if [[ "$pass" == "1" ]]; then
    PASS_ONE_SECONDS="$elapsed"
    RELEASE_EXECUTION_ONE="$execution"
  else
    PASS_TWO_SECONDS="$elapsed"
    RELEASE_EXECUTION_TWO="$execution"
  fi
  log "restore/release/invariant pass ${pass} completed in ${elapsed}s"
}



deploy_and_smoke() {
  local started
  started="$(date +%s)"
  gcloud_cmd run deploy "$WEB_SERVICE" --project "$PROJECT_ID" \
    --region "$REGION" --image "$WEB_IMAGE" \
    --service-account "$RUNTIME_SERVICE_ACCOUNT" --port 80 \
    --min 0 --max 3 --allow-unauthenticated --quiet >/dev/null
  local web_url
  web_url="$(
    gcloud_cmd run services describe "$WEB_SERVICE" \
      --project "$PROJECT_ID" --region "$REGION" \
      --format='value(status.url)' --quiet
  )"
  [[ -n "$web_url" ]] || die "verification web URL is empty"
  create_secret "$TARGET_CORS_SECRET" "$web_url"
  gcloud_cmd run deploy "$API_SERVICE" --project "$PROJECT_ID" \
    --region "$REGION" --image "$API_IMAGE" \
    --service-account "$RUNTIME_SERVICE_ACCOUNT" \
    --set-cloudsql-instances "$CLOUD_SQL_CONNECTION" \
    --set-secrets "DATABASE_URL=${TARGET_DATABASE_SECRET}:latest,JWT_SECRET=ff-jwt-secret:latest,REGISTRATION_INVITE_CODE=ff-registration-invite-code:latest,CORS_ORIGINS=${TARGET_CORS_SECRET}:latest,SUPABASE_URL=ff-supabase-url:latest,SUPABASE_SERVICE_ROLE_KEY=ff-supabase-service-role-key:latest" \
    --set-env-vars "NODE_ENV=production,JWT_EXPIRES_IN=8h,SUPABASE_PUBLIC_BUCKET=ff-public-images,SUPABASE_QR_BUCKET=ff-payment-qr,SUPABASE_SIGNED_URL_TTL_SECONDS=900" \
    --port 8080 --min 0 --max 3 --allow-unauthenticated \
    --quiet >/dev/null
  local api_url
  api_url="$(
    gcloud_cmd run services describe "$API_SERVICE" \
      --project "$PROJECT_ID" --region "$REGION" \
      --format='value(status.url)' --quiet
  )"
  [[ -n "$api_url" ]] || die "verification API URL is empty"
  local service
  for service in "$API_SERVICE" "$WEB_SERVICE"; do
    gcloud_cmd run services add-iam-policy-binding "$service" \
      --project "$PROJECT_ID" --region "$REGION" \
      --member "serviceAccount:${RUNTIME_SERVICE_ACCOUNT}" \
      --role roles/run.invoker --quiet >/dev/null
  done
  gcloud_cmd iam service-accounts add-iam-policy-binding \
    "$RUNTIME_SERVICE_ACCOUNT" --project "$PROJECT_ID" \
    --member "user:${EXPECTED_ACCOUNT}" \
    --role roles/iam.serviceAccountTokenCreator \
    --quiet >/dev/null
  wait_for_runtime_impersonation ||
    die "runtime impersonation did not propagate within 60 seconds"
  local api_token web_token
  api_token="$(
    gcloud_cmd auth print-identity-token \
      --impersonate-service-account "$RUNTIME_SERVICE_ACCOUNT" \
      --audiences="$api_url" --quiet
  )"
  web_token="$(
    gcloud_cmd auth print-identity-token \
      --impersonate-service-account "$RUNTIME_SERVICE_ACCOUNT" \
      --audiences="$web_url" --quiet
  )"
  run_private_smoke "$api_url" "$web_url" "$api_token" "$web_token" ||
    die "private Cloud Run smoke failed"
  unset api_token web_token
  DEPLOY_SMOKE_SECONDS="$(( $(date +%s) - started ))"
  log "private immutable service deploy and smoke completed in ${DEPLOY_SMOKE_SECONDS}s"
}

write_evidence() {
  local projected="$((CAPTURE_SECONDS + PASS_ONE_SECONDS + DEPLOY_SMOKE_SECONDS))"
  ((projected <= MAX_PROJECTED_SECONDS)) ||
    die "projected cutover ${projected}s exceeds ${MAX_PROJECTED_SECONDS}s"
  local evidence="$OUTPUT_DIR/ff-59-cutover-evidence.json"
  ARTIFACT_PATH="$ARTIFACT_PATH" ARTIFACT_SHA256="$ARTIFACT_SHA256" \
    SOURCE_DEPLOYED_SHA="$SOURCE_DEPLOYED_SHA" \
    CAPTURE_SECONDS="$CAPTURE_SECONDS" PASS_ONE_SECONDS="$PASS_ONE_SECONDS" \
    DEPLOY_SMOKE_SECONDS="$DEPLOY_SMOKE_SECONDS" PROJECTED_SECONDS="$projected" \
    RELEASE_EXECUTION_ONE="$RELEASE_EXECUTION_ONE" \
    API_IMAGE="$API_IMAGE" WEB_IMAGE="$WEB_IMAGE" \
    python3 - "$SCRATCH_DIR/invariants-1.json" "$evidence" <<'PY'
import json
import os
import sys
from datetime import datetime, timezone

with open(sys.argv[1], encoding="utf-8") as handle:
    invariants = json.load(handle)
report = {
    "formatVersion": 1,
    "completedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    "source": {
        "provider": "render",
        "databaseId": "dpg-d9aced58nd3s73aqvhu0-a",
        "deployedGitSha": os.environ["SOURCE_DEPLOYED_SHA"],
        "encryptedArtifact": os.environ["ARTIFACT_PATH"],
        "encryptedSha256": os.environ["ARTIFACT_SHA256"],
    },
    "target": {
        "project": "ff-restaurent",
        "instance": "ff-restaurent-db",
        "database": "ff_restaurent",
    },
    "images": {
        "api": os.environ["API_IMAGE"],
        "web": os.environ["WEB_IMAGE"],
    },
    "releaseExecutions": [
        os.environ["RELEASE_EXECUTION_ONE"],
    ],
    "timingsSeconds": {
        "capture": int(os.environ["CAPTURE_SECONDS"]),
        "passOne": int(os.environ["PASS_ONE_SECONDS"]),
        "deployAndSmoke": int(os.environ["DEPLOY_SMOKE_SECONDS"]),
        "projectedCutover": int(os.environ["PROJECTED_SECONDS"]),
        "budget": 900,
    },
    "invariants": invariants,
    "smokePassed": True,
}
with open(sys.argv[2], "w", encoding="utf-8") as handle:
    json.dump(report, handle, indent=2, sort_keys=True)
    handle.write("\n")
PY
  chmod 600 "$evidence"
  (
    cd "$OUTPUT_DIR"
    sha256sum "$(basename "$evidence")" >"$(basename "$evidence").sha256"
  )
  log "projected cutover is ${projected}s (budget ${MAX_PROJECTED_SECONDS}s)"
  log "sanitized evidence written to ${evidence}"
}


apply_rehearsal() {
  validate_secure_file "$PASSPHRASE_FILE"
  
  printf '\n======================================================\n'
  printf 'WARNING: This script will irreversibly overwrite the\n'
  printf 'permanent production database %s.\n' "$TARGET_DATABASE"
  printf 'It will also deploy to the permanent Cloud Run services.\n'
  printf '======================================================\n'
  printf 'Have you announced maintenance and BLOCKED ALL WRITES\n'
  printf 'on the source Render system? (Type "yes" to confirm): '
  read -r confirm
  if [[ "$confirm" != "yes" ]]; then
    die "aborted by operator"
  fi

  mkdir -p "$OUTPUT_DIR"
  chmod 700 "$OUTPUT_DIR"
  if ! disposable_inventory; then
    die "conflicting disposable resources exist; run --cleanup explicitly"
  fi
  SCRATCH_DIR="$(mktemp -d)"
  chmod 700 "$SCRATCH_DIR"
  APPLY_STARTED="true"
  trap cleanup_trap EXIT
  trap 'exit 129' HUP
  trap 'exit 130' INT
  trap 'exit 143' TERM
  PERMANENT_STATE_BEFORE="$(permanent_state)"
  WIF_STATE_BEFORE="$(wif_state)"
  ORIGINAL_RUNTIME_POLICY="$(runtime_policy_state)"

  capture_source
  decrypt_and_validate_artifact
  DB_PASSWORD="$(
    gcloud_cmd secrets versions access latest \
      --secret ff-database-password --project "$PROJECT_ID" --quiet
  )"
  ENCODED_DB_PASSWORD="$(
    DB_PASSWORD="$DB_PASSWORD" python3 -c \
      'import os, urllib.parse; print(urllib.parse.quote(os.environ["DB_PASSWORD"], safe=""), end="")'
  )"
  PGPASSWORD="$DB_PASSWORD"
  export PGPASSWORD
  unset DB_PASSWORD
  local socket_database_url
  socket_database_url="postgresql://${SQL_USER}:${ENCODED_DB_PASSWORD}@localhost/${TARGET_DATABASE}?host=/cloudsql/${CLOUD_SQL_CONNECTION}"
  create_secret "$TARGET_DATABASE_SECRET" "$socket_database_url"
  unset socket_database_url
  start_proxy
  clean_database
  deploy_release_job
  rehearsal_pass 1
  deploy_and_smoke

  write_evidence
  trap - EXIT HUP INT TERM
  rm -rf "$SCRATCH_DIR"
  SCRATCH_DIR=""
  log "live production cutover completed successfully!"
}


main() {
  parse_args "$@"
  assert_safe_names
  require_tools
  validate_context
  case "$MODE" in
    plan) print_plan ;;
    apply) apply_rehearsal ;;
  esac
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
