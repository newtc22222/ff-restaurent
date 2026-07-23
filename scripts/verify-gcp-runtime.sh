#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/provision-gcp-foundation.sh
source "${SCRIPT_DIR}/provision-gcp-foundation.sh"

OPERATOR_MEMBER="user:${EXPECTED_ACCOUNT}"
PROXY_BIN="${CLOUD_SQL_PROXY_BIN:-$HOME/.local/bin/cloud-sql-proxy}"
PROXY_PORT="${CLOUD_SQL_PROXY_PORT:-55432}"
TEMP_GRANT_ADDED="false"
PROXY_PID=""
PROXY_LOG="$(mktemp)"

cleanup() {
  if [[ -n "$PROXY_PID" ]]; then
    kill "$PROXY_PID" >/dev/null 2>&1 || true
    wait "$PROXY_PID" >/dev/null 2>&1 || true
  fi
  unset CSQL_PROXY_TOKEN PGPASSWORD
  if [[ "$TEMP_GRANT_ADDED" == "true" ]]; then
    gcloud_cmd iam service-accounts remove-iam-policy-binding "$RUNTIME_SERVICE_ACCOUNT" \
      --project "$PROJECT_ID" \
      --member "$OPERATOR_MEMBER" \
      --role roles/iam.serviceAccountTokenCreator \
      --quiet >/dev/null 2>&1 || true
    log "Temporary runtime impersonation grant removed"
  fi
  rm -f "$PROXY_LOG"
}
trap cleanup EXIT

command -v psql >/dev/null 2>&1 || die "psql is required"
[[ -x "$PROXY_BIN" ]] || die "Cloud SQL Auth Proxy is required at ${PROXY_BIN}"
validate_cloud_context

gcloud_cmd iam service-accounts add-iam-policy-binding "$RUNTIME_SERVICE_ACCOUNT" \
  --project "$PROJECT_ID" \
  --member "$OPERATOR_MEMBER" \
  --role roles/iam.serviceAccountTokenCreator \
  --quiet >/dev/null
TEMP_GRANT_ADDED="true"
log "Temporary runtime impersonation grant added"

impersonation_ready="false"
for _ in {1..30}; do
  if gcloud_cmd auth print-access-token \
      --impersonate-service-account "$RUNTIME_SERVICE_ACCOUNT" \
      --quiet >/dev/null 2>&1; then
    impersonation_ready="true"
    break
  fi
  sleep 2
done
[[ "$impersonation_ready" == "true" ]] || die "runtime impersonation did not propagate within 60 seconds"
log "Runtime impersonation is ready"

for secret_name in ff-database-url ff-database-password ff-jwt-secret ff-registration-invite-code ff-root-admin-username ff-cors-origins ff-supabase-url ff-supabase-service-role-key; do
  gcloud_cmd secrets versions access latest \
    --secret "$secret_name" \
    --project "$PROJECT_ID" \
    --impersonate-service-account "$RUNTIME_SERVICE_ACCOUNT" \
    --quiet >/dev/null
done
log "Runtime identity accessed exactly eight required secrets"

CSQL_PROXY_TOKEN="$(
  gcloud_cmd auth print-access-token \
    --impersonate-service-account "$RUNTIME_SERVICE_ACCOUNT" \
    --quiet
)"
export CSQL_PROXY_TOKEN
PGPASSWORD="$(
  gcloud_cmd secrets versions access latest \
    --secret ff-database-password \
    --project "$PROJECT_ID" \
    --impersonate-service-account "$RUNTIME_SERVICE_ACCOUNT" \
    --quiet
)"
export PGPASSWORD

"$PROXY_BIN" \
  --port "$PROXY_PORT" \
  --quiet \
  "${PROJECT_ID}:${REGION}:${SQL_INSTANCE}" \
  >"$PROXY_LOG" 2>&1 &
PROXY_PID="$!"

proxy_ready="false"
for _ in {1..30}; do
  if pg_isready --host 127.0.0.1 --port "$PROXY_PORT" --timeout 1 >/dev/null 2>&1; then
    proxy_ready="true"
    break
  fi
  if ! kill -0 "$PROXY_PID" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
[[ "$proxy_ready" == "true" ]] || die "Cloud SQL Auth Proxy did not become ready"
log "Cloud SQL Auth Proxy is ready under the runtime identity"

psql \
  --no-psqlrc \
  --set ON_ERROR_STOP=1 \
  --host 127.0.0.1 \
  --port "$PROXY_PORT" \
  --username "$SQL_USER" \
  --dbname "$SQL_DATABASE" \
  --tuples-only \
  --no-align \
  --command="SELECT current_database(), current_user, current_setting('server_version_num');"

public_ip="$(
  gcloud_cmd sql instances describe "$SQL_INSTANCE" \
    --project "$PROJECT_ID" \
    --format='value(ipAddresses[0].ipAddress)' \
    --quiet
)"
if psql \
  --no-psqlrc \
  "host=${public_ip} port=5432 user=${SQL_USER} dbname=${SQL_DATABASE} connect_timeout=5" \
  --command='SELECT 1' >/dev/null 2>&1; then
  die "direct public PostgreSQL connection unexpectedly succeeded"
fi
log "Direct public PostgreSQL connection is blocked"

log "Runtime identity and Cloud SQL connectivity verification passed"
