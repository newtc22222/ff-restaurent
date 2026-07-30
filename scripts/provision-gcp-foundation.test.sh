#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUBJECT="${ROOT}/scripts/provision-gcp-foundation.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fail() {
  printf 'not ok - %s\n' "$1" >&2
  exit 1
}

pass() {
  printf 'ok - %s\n' "$1"
}

write_context_mock() {
  local account="${1:-phi.vo.tech@gmail.com}"
  cat >"$TMP/gcloud" <<EOF
#!/usr/bin/env bash
set -euo pipefail
args="\$*"
case "\$args" in
  "config get-value account"*) printf '%s\n' '$account' ;;
  "projects describe ff-restaurent"*) printf '%s\n' '192523226156' ;;
  "billing projects describe ff-restaurent"*) printf '%s\t%s\n' True billingAccounts/01D2B2-BCD7E8-002699 ;;
  "services list"*) printf '%s\n' logging.googleapis.com monitoring.googleapis.com ;;
  *) printf 'unexpected mock call: %s\n' "\$args" >&2; exit 90 ;;
esac
EOF
  chmod 700 "$TMP/gcloud"
}

write_apply_mock() {
  cat >"$TMP/gcloud" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
args="$*"
printf '%s\n' "$args" >>"$GCLOUD_MOCK_LOG"
case "$args" in
  "config get-value account"*) echo phi.vo.tech@gmail.com ;;
  "projects describe ff-restaurent"*) echo 192523226156 ;;
  "billing projects describe ff-restaurent"*) printf 'True\tbillingAccounts/01D2B2-BCD7E8-002699\n' ;;
  "services list"*) printf '%s\n' run.googleapis.com sqladmin.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com iamcredentials.googleapis.com sts.googleapis.com billingbudgets.googleapis.com logging.googleapis.com monitoring.googleapis.com ;;
  *"projects get-iam-policy"*|*"service-accounts get-iam-policy"*|*"secrets get-iam-policy"*)
    case "$args" in
      *roles/cloudsql.client*) echo roles/cloudsql.client ;;
      *roles/run.admin*) echo roles/run.admin ;;
      *roles/artifactregistry.writer*) echo roles/artifactregistry.writer ;;
      *roles/cloudsql.viewer*) echo roles/cloudsql.viewer ;;
      *roles/iam.serviceAccountUser*) echo roles/iam.serviceAccountUser ;;
      *roles/iam.workloadIdentityUser*) echo roles/iam.workloadIdentityUser ;;
      *roles/secretmanager.secretAccessor*) echo roles/secretmanager.secretAccessor ;;
    esac
    ;;
  "iam service-accounts describe "*) : ;;
  "sql instances describe ff-restaurent-db"*)
    if [[ "$args" == *"connectionName"* ]]; then
      echo ff-restaurent:asia-east1:ff-restaurent-db
    else
      printf 'POSTGRES_16\tdb-custom-1-3840\tasia-east1\tTrue\n'
    fi
    ;;
  "sql instances patch "*) : ;;
  "secrets describe "*) : ;;
  "secrets versions access latest"*)
    case "$args" in
      *"--secret ff-database-password"*) printf db-password ;;
      *"--secret ff-database-url"*) printf 'postgresql://ff_app:db-password@localhost/ff_restaurent?host=/cloudsql/ff-restaurent:asia-east1:ff-restaurent-db' ;;
      *"--secret ff-jwt-secret"*) printf 'this-is-a-jwt-secret-with-more-than-32-characters' ;;
      *"--secret ff-registration-invite-code"*) printf invite ;;
      *"--secret ff-root-admin-username"*) printf root ;;
      *"--secret ff-cors-origins"*) printf 'https://ff-restaurent-web.example.run.app' ;;
      *"--secret ff-supabase-url"*) printf 'https://example.supabase.co' ;;
      *"--secret ff-supabase-service-role-key"*) printf service-role ;;
    esac
    ;;
  "sql databases describe "*) : ;;
  "sql users list "*) echo ff_app ;;
  "sql users set-password "*) : ;;
  "artifacts repositories describe "*) : ;;
  "iam workload-identity-pools describe "*) : ;;
  "iam workload-identity-pools providers describe "*) : ;;
  "run services describe ff-restaurent-api"*)
    if [[ "$args" == *"--format=json"* ]]; then
      printf '%s\n' '{"spec":{"template":{"metadata":{"annotations":{"autoscaling.knative.dev/maxScale":"1","run.googleapis.com/cloudsql-instances":"ff-restaurent:asia-east1:ff-restaurent-db"}},"spec":{"serviceAccountName":"ff-runtime@ff-restaurent.iam.gserviceaccount.com","containers":[{"image":"us-docker.pkg.dev/cloudrun/container/hello@sha256:65067ea5c18ca5433861c58673f1cb5d0b9ca4b0be3bf9081446359770bb81ad"}]}}}}'
    fi
    ;;
  "run services describe ff-restaurent-web"*)
    if [[ "$args" == *"--format=json"* ]]; then
      printf '%s\n' '{"spec":{"template":{"metadata":{"annotations":{"autoscaling.knative.dev/maxScale":"1"}},"spec":{"serviceAccountName":"ff-runtime@ff-restaurent.iam.gserviceaccount.com","containers":[{"image":"us-docker.pkg.dev/cloudrun/container/hello@sha256:65067ea5c18ca5433861c58673f1cb5d0b9ca4b0be3bf9081446359770bb81ad"}]}}}}'
    elif [[ "$args" == *"status.url"* ]]; then
      echo 'https://ff-restaurent-web.example.run.app'
    fi
    ;;
  "run deploy "*) : ;;
  "billing budgets list "*) printf '%s\n' '[{"name":"billingAccounts/01D2B2-BCD7E8-002699/budgets/existing-budget","displayName":"FF RESTaurent monthly"}]' ;;
  "billing budgets update existing-budget"*) : ;;
  *) printf 'unexpected mock call: %s\n' "$args" >&2; exit 90 ;;
esac
EOF
  chmod 700 "$TMP/gcloud"
}

write_valid_secrets() {
  local directory="$TMP/secure"
  mkdir -p "$directory"
  chmod 700 "$directory"
  cat >"$directory/secrets.json" <<'EOF'
{
  "JWT_SECRET": "this-is-a-jwt-secret-with-more-than-32-characters",
  "REGISTRATION_INVITE_CODE": "invite",
  "ROOT_ADMIN_USERNAME": "root",
  "SUPABASE_URL": "https://example.supabase.co",
  "SUPABASE_SERVICE_ROLE_KEY": "service-role"
}
EOF
  chmod 600 "$directory/secrets.json"
  printf '%s' "$directory/secrets.json"
}

write_context_mock
plan_output="$(GCLOUD_BIN="$TMP/gcloud" bash "$SUBJECT" --plan)"
grep -Fq 'Read-only plan for ff-restaurent' <<<"$plan_output" || fail 'read-only plan output'
pass 'read-only plan output'

write_context_mock wrong@example.com
if GCLOUD_BIN="$TMP/gcloud" bash "$SUBJECT" --plan >"$TMP/out" 2>"$TMP/err"; then
  fail 'wrong account rejected'
fi
grep -Fq 'active gcloud account must be' "$TMP/err" || fail 'wrong account message'
pass 'wrong account rejected'

write_context_mock
if GCLOUD_BIN="$TMP/gcloud" bash "$SUBJECT" --apply --secrets-file "$TMP/missing.json" >"$TMP/out" 2>"$TMP/err"; then
  fail 'missing secrets rejected'
fi
grep -Fq 'secrets file does not exist' "$TMP/err" || fail 'missing secrets message'
pass 'missing secrets rejected'

secrets_file="$(write_valid_secrets)"
chmod 644 "$secrets_file"
if GCLOUD_BIN="$TMP/gcloud" bash "$SUBJECT" --apply --secrets-file "$secrets_file" >"$TMP/out" 2>"$TMP/err"; then
  fail 'permissive secrets rejected'
fi
grep -Fq 'secrets file mode must be 600' "$TMP/err" || fail 'permissive secrets message'
pass 'permissive secrets rejected'

chmod 600 "$secrets_file"
printf '{invalid' >"$secrets_file"
if GCLOUD_BIN="$TMP/gcloud" bash "$SUBJECT" --apply --secrets-file "$secrets_file" >"$TMP/out" 2>"$TMP/err"; then
  fail 'malformed secrets rejected'
fi
grep -Fq 'invalid secrets JSON' "$TMP/err" || fail 'malformed secrets message'
pass 'malformed secrets rejected'

secrets_file="$(write_valid_secrets)"
write_context_mock
if GCLOUD_BIN="$TMP/gcloud" bash "$SUBJECT" --apply --secrets-file "$secrets_file" >"$TMP/out" 2>"$TMP/err"; then
  fail 'failed API enablement propagated'
fi
grep -Fq 'services enable run.googleapis.com' "$TMP/err" || fail 'failed API enablement message'
pass 'failed API enablement propagated'

secrets_file="$(write_valid_secrets)"
sed -i 's/"invite"/"changed-invite"/' "$secrets_file"
write_apply_mock
export GCLOUD_MOCK_LOG="$TMP/gcloud.log"
if GCLOUD_BIN="$TMP/gcloud" bash "$SUBJECT" --apply --secrets-file "$secrets_file" >"$TMP/out" 2>"$TMP/err"; then
  fail 'failed secret version propagated'
fi
grep -Fq 'secrets versions add ff-registration-invite-code' "$TMP/err" || fail 'failed secret version message'
if grep -Fq 'changed-invite' "$TMP/out" "$TMP/err"; then
  fail 'secret value leaked during failure'
fi
pass 'failed secret version propagated without value leakage'

secrets_file="$(write_valid_secrets)"
write_apply_mock
export GCLOUD_MOCK_LOG="$TMP/gcloud.log"
: >"$GCLOUD_MOCK_LOG"
GCLOUD_BIN="$TMP/gcloud" bash "$SUBJECT" --apply --secrets-file "$secrets_file" >"$TMP/apply.out"
grep -Fq 'Foundation apply completed without production cutover' "$TMP/apply.out" || fail 'safe rerun completion'
if grep -Eq ' (create|enable|add-iam-policy-binding|versions add) ' "$TMP/gcloud.log"; then
  fail 'safe rerun performed a create operation'
fi
pass 'partial existing resources and safe rerun'

printf '1..8\n'
