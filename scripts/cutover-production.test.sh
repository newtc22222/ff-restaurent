#!/usr/bin/env bash
# shellcheck disable=SC2329 # test doubles are invoked indirectly
set -euo pipefail

test_root="$(mktemp -d)"
trap 'rm -rf "$test_root"' EXIT
export HOME="$test_root/home"
mkdir -p "$HOME/.config/ff-restaurent" "$HOME/.local/state"
chmod 700 "$HOME/.config" "$HOME/.config/ff-restaurent"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/cutover-production.sh
source "$script_dir/cutover-production.sh"

fail() {
  printf 'FF-59 focused test failed: %s\n' "$*" >&2
  exit 1
}

expect_failure() {
  local label="$1"
  shift
  if ("$@") >"$test_root/case.log" 2>&1; then
    fail "${label} unexpectedly succeeded"
  fi
}

secure_file="$HOME/.config/ff-restaurent/passphrase"
printf '%s\n' 'focused-rehearsal-passphrase' >"$secure_file"
chmod 600 "$secure_file"
validate_secure_file "$secure_file"
chmod 644 "$secure_file"
expect_failure "permissive secret file" validate_secure_file "$secure_file"
chmod 600 "$secure_file"

context_case() (
  local fault="$1"
  gcloud_cmd() {
    case "$*" in
      "config get-value account --quiet")
        [[ "$fault" == account ]] && printf '%s\n' wrong@example.test ||
          printf '%s\n' "$EXPECTED_ACCOUNT"
        ;;
      "config get-value project --quiet")
        [[ "$fault" == project ]] && printf '%s\n' wrong-project ||
          printf '%s\n' "$PROJECT_ID"
        ;;
      "projects describe ff-restaurent --format=value(projectNumber) --quiet")
        printf '%s\n' "$PROJECT_NUMBER"
        ;;
      "billing projects describe ff-restaurent --format=value(billingEnabled) --quiet")
        [[ "$fault" == billing ]] && printf '%s\n' False || printf '%s\n' True
        ;;
      "sql instances describe ff-restaurent-db --project ff-restaurent --format=value(databaseVersion) --quiet")
        printf '%s\n' POSTGRES_16
        ;;
      *)
        return 1
        ;;
    esac
  }
  render() {
    case "$1 $2" in
      "whoami --output") printf '{}\n' ;;
      "pg get")
        printf '{"data":{"id":"%s","status":"available","version":"16"}}\n' \
          "$RENDER_DATABASE_ID"
        ;;
      *) return 1 ;;
    esac
  }
  validate_context
)

expect_failure "wrong account" context_case account
expect_failure "wrong project" context_case project
expect_failure "disabled billing" context_case billing
context_case none


make_artifact() {
  local case_name="$1"
  local manifest_migrations="${2:-17}"
  local fixture="$test_root/${case_name}-fixture"
  local output="$test_root/${case_name}-output"
  mkdir -p "$fixture" "$output"
  printf 'dump\n' >"$fixture/production.dump"
  printf 'table|1\n' >"$fixture/row-counts.tsv"
  sha256sum "$fixture/production.dump" |
    sed 's#  .*/#  #' >"$fixture/production.dump.sha256"
  sha256sum "$fixture/row-counts.tsv" |
    sed 's#  .*/#  #' >"$fixture/row-counts.tsv.sha256"
  {
    printf '%s\n' \
      'source_database_version=16.14' \
      "applied_migrations=${manifest_migrations}" \
      'rolled_back_migrations=0' \
      'phase2_contract_migrations=1'
  } >"$fixture/manifest.txt"
  local index
  for index in {1..16}; do
    printf 'migration-%02d|done|\n' "$index"
  done >"$fixture/migrations.tsv"
  printf '%s|done|\n' \
    '20260720000000_contract_phase2_normalized_restaurants' \
    >>"$fixture/migrations.tsv"
  tar --create --gzip --file "$output/source.tar.gz" --directory "$fixture" .
  printf '%s\n' 'focused-rehearsal-passphrase' |
    gpg --batch --yes --pinentry-mode loopback --passphrase-fd 0 \
      --symmetric --cipher-algo AES256 \
      --output "$output/source.tar.gz.gpg" "$output/source.tar.gz"
  (
    cd "$output"
    sha256sum source.tar.gz.gpg >source.tar.gz.gpg.sha256
  )
  printf '%s\n' "$output/source.tar.gz.gpg"
}

artifact_success="$(make_artifact success)"
ARTIFACT_PATH="$artifact_success"
SCRATCH_DIR="$test_root/success-scratch"
PASSPHRASE_FILE="$secure_file"
mkdir "$SCRATCH_DIR"
pg_restore() {
  [[ "$1" == "--list" ]]
}
decrypt_and_validate_artifact

artifact_checksum="$(make_artifact checksum)"
printf '0%.0s' {1..64} >"${artifact_checksum}.sha256"
printf '  %s\n' "$(basename "$artifact_checksum")" >>"${artifact_checksum}.sha256"
ARTIFACT_PATH="$artifact_checksum"
SCRATCH_DIR="$test_root/checksum-scratch"
mkdir "$SCRATCH_DIR"
expect_failure "checksum failure" decrypt_and_validate_artifact

artifact_decrypt="$(make_artifact decrypt)"
wrong_passphrase="$HOME/.config/ff-restaurent/wrong-passphrase"
printf '%s\n' 'different-secret-marker' >"$wrong_passphrase"
chmod 600 "$wrong_passphrase"
ARTIFACT_PATH="$artifact_decrypt"
PASSPHRASE_FILE="$wrong_passphrase"
SCRATCH_DIR="$test_root/decrypt-scratch"
mkdir "$SCRATCH_DIR"
expect_failure "decryption failure" decrypt_and_validate_artifact
if grep -Fq 'different-secret-marker' "$test_root/case.log"; then
  fail "decryption failure exposed the passphrase"
fi

artifact_manifest="$(make_artifact manifest 16)"
ARTIFACT_PATH="$artifact_manifest"
PASSPHRASE_FILE="$secure_file"
SCRATCH_DIR="$test_root/manifest-scratch"
mkdir "$SCRATCH_DIR"
expect_failure "incomplete migration manifest" decrypt_and_validate_artifact

PASSPHRASE_FILE="$secure_file"
SCRATCH_DIR="$test_root/pass"
mkdir -p "$SCRATCH_DIR/source"
printf 'table|1\n' >"$SCRATCH_DIR/source/row-counts.tsv"
printf 'dump\n' >"$SCRATCH_DIR/source/production.dump"
PGPASSWORD=not-logged
export PGPASSWORD
pg_restore() {
  return 0
}
capture_restored_counts() {
  cp "$SCRATCH_DIR/source/row-counts.tsv" "$1"
}
execute_release_job() {
  printf 'execution-1\n'
}
run_invariants() {
  printf '{"checkedAt":"now","passed":true}\n' \
    >"$SCRATCH_DIR/invariants-$1.json"
}
rehearsal_pass 1

pg_restore() {
  return 1
}
expect_failure "restore failure" rehearsal_pass 1
pg_restore() {
  return 0
}

capture_restored_counts() {
  printf 'table|2\n' >"$1"
}
expect_failure "restored count drift" rehearsal_pass 1

capture_restored_counts() {
  cp "$SCRATCH_DIR/source/row-counts.tsv" "$1"
}
execute_release_job() {
  return 1
}
expect_failure "release failure" rehearsal_pass 1

execute_release_job() {
  printf 'execution-1\n'
}
run_invariants() {
  return 1
}
expect_failure "invariant failure" rehearsal_pass 1

gcloud_cmd() {
  return 1
}
sleep() {
  :
}
FF58_IMPERSONATION_ATTEMPTS=1
export FF58_IMPERSONATION_ATTEMPTS
expect_failure "impersonation timeout" wait_for_runtime_impersonation

npm_cmd() {
  return 1
}
expect_failure "private smoke failure" run_private_smoke \
  https://api.example.test https://web.example.test \
  sensitive-api-token sensitive-web-token
if grep -Eq 'sensitive-(api|web)-token' "$test_root/case.log"; then
  fail "smoke failure exposed an identity token"
fi
unset FF58_IMPERSONATION_ATTEMPTS
unset -f sleep

if grep -Eq 'set -x|BACKUP_PASSPHRASE=.*echo|PGPASSWORD=.*echo' \
    "$script_dir/cutover-production.sh"; then
  fail "operator script contains unsafe tracing or secret output"
fi

echo "FF-59 rehearsal focused tests passed"
