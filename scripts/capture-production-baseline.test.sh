#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
capture_script="$script_dir/capture-production-baseline.sh"
render_capture_script="$script_dir/capture-render-production-baseline.sh"
test_root="$(mktemp -d)"
trap 'rm -rf "$test_root"' EXIT

mock_bin="$test_root/bin"
mkdir -p "$mock_bin"

cat >"$mock_bin/psql" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail

if [[ "${MOCK_PSQL_FAIL:-0}" == "1" ]]; then
  exit 1
fi

output_file=""
while IFS= read -r line; do
  case "$line" in
    *pg_export_snapshot*)
      echo "00000001-00000001-1"
      ;;
    "\\o ")
      output_file=""
      ;;
    "\\o "*)
      output_file="${line#\\o }"
      ;;
    "\\gexec")
      printf 'Bill|3\n_prisma_migrations|17\n' >"$output_file"
      ;;
    *"current_setting('server_version')"*)
      printf '16.14|ff_test\n' >"$output_file"
      ;;
    *"SELECT migration_name ||"*)
      : >"$output_file"
      migration_count="${MOCK_MIGRATION_COUNT:-17}"
      for ((index = 1; index <= migration_count; index += 1)); do
        if [[ "$index" == "$migration_count" ]]; then
          migration_name="20260720000000_contract_phase2_normalized_restaurants"
        else
          migration_name="migration-$index"
        fi
        printf '%s|2026-07-22T00:00:00.000000Z|\n' "$migration_name" >>"$output_file"
      done
      ;;
    *"COUNT(*) FILTER"*)
      printf '%s|0|1\n' "${MOCK_MIGRATION_COUNT:-17}" >"$output_file"
      ;;
    "\\q")
      exit 0
      ;;
  esac
done
MOCK

cat >"$mock_bin/pg_dump" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail

if [[ "${MOCK_PG_DUMP_FAIL:-0}" == "1" ]]; then
  exit 1
fi

output_file=""
snapshot_seen="0"
for argument in "$@"; do
  case "$argument" in
    --file=*) output_file="${argument#--file=}" ;;
    --snapshot=*) snapshot_seen="1" ;;
  esac
done

[[ -n "$output_file" && "$snapshot_seen" == "1" ]]
printf 'mock custom-format dump\n' >"$output_file"
MOCK

cat >"$mock_bin/pg_restore" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail

if [[ "${MOCK_PG_RESTORE_FAIL:-0}" == "1" ]]; then
  exit 1
fi

echo "; Archive created for focused test"
MOCK

cat >"$mock_bin/gpg" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail

if [[ "${MOCK_GPG_FAIL:-0}" == "1" ]]; then
  exit 1
fi

output_file=""
input_file="${!#}"
while (($#)); do
  if [[ "$1" == "--output" ]]; then
    output_file="$2"
    shift 2
  else
    shift
  fi
done

cat >/dev/null
cp "$input_file" "$output_file"
MOCK

cat >"$mock_bin/render" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail

printf '%s\n' "$*" >"${MOCK_RENDER_ARGUMENTS_FILE:?}"
printf '%s\n' '{"data":{"connectionInfo":{"externalConnectionString":"postgresql://user:do-not-log@example.invalid/db?schema=public"}}}'
MOCK

chmod +x \
  "$mock_bin/psql" \
  "$mock_bin/pg_dump" \
  "$mock_bin/pg_restore" \
  "$mock_bin/gpg" \
  "$mock_bin/render"

common_environment=(
  "DATABASE_URL=postgresql://user:do-not-log@example.invalid/db"
  "BACKUP_PASSPHRASE=focused-test-passphrase"
  "DEPLOYED_GIT_SHA=0638ae3aa622b30ed024302106802d32458d3d32"
  "SOURCE_DATABASE_ID=focused-test-db"
  "PSQL_BIN=$mock_bin/psql"
  "PG_DUMP_BIN=$mock_bin/pg_dump"
  "PG_RESTORE_BIN=$mock_bin/pg_restore"
  "GPG_BIN=$mock_bin/gpg"
)

run_failure_case() {
  local case_name="$1"
  local expected_message="$2"
  shift 2

  local output_dir="$test_root/$case_name"
  local output
  set +e
  output="$(env "${common_environment[@]}" "BASELINE_OUTPUT_DIR=$output_dir" "$@" bash "$capture_script" 2>&1)"
  local exit_code=$?
  set -e

  if [[ "$exit_code" == "0" ]]; then
    echo "Focused baseline test failed: $case_name unexpectedly succeeded" >&2
    exit 1
  fi
  if [[ "$output" != *"$expected_message"* ]]; then
    echo "Focused baseline test failed: $case_name returned an unexpected error" >&2
    exit 1
  fi
  if [[ "$output" == *"do-not-log"* || "$output" == *"focused-test-passphrase"* ]]; then
    echo "Focused baseline test failed: $case_name exposed a credential" >&2
    exit 1
  fi
}

success_output="$test_root/success"
success_log="$(env "${common_environment[@]}" "BASELINE_OUTPUT_DIR=$success_output" bash "$capture_script" 2>&1)"
if [[ "$success_log" == *"do-not-log"* || "$success_log" == *"focused-test-passphrase"* ]]; then
  echo "Focused baseline test failed: successful capture exposed a credential" >&2
  exit 1
fi

artifact_path="$(find "$success_output" -maxdepth 1 -type f -name '*.tar.gz.gpg' -print -quit)"
[[ -n "$artifact_path" && -s "$artifact_path" ]]
if find "$success_output" -maxdepth 1 -type f ! -name '*.tar.gz.gpg' ! -name '*.tar.gz.gpg.sha256' | grep -q .; then
  echo "Focused baseline test failed: plaintext evidence escaped the temporary directory" >&2
  exit 1
fi
(
  cd "$success_output"
  sha256sum --check "$(basename "$artifact_path").sha256" >/dev/null
)

run_failure_case \
  invalid-sha \
  "DEPLOYED_GIT_SHA must be a 40-character lowercase Git SHA" \
  "DEPLOYED_GIT_SHA=not-a-sha"
run_failure_case \
  unreachable-source \
  "PostgreSQL did not export a snapshot" \
  "MOCK_PSQL_FAIL=1"
run_failure_case \
  failed-dump \
  "pg_dump failed" \
  "MOCK_PG_DUMP_FAIL=1"
run_failure_case \
  failed-dump-listing \
  "pg_restore could not list the dump" \
  "MOCK_PG_RESTORE_FAIL=1"
run_failure_case \
  incomplete-migrations \
  "migration state does not match the released Phase 2 boundary" \
  "MOCK_MIGRATION_COUNT=16"
run_failure_case \
  failed-encryption \
  "GPG encryption failed" \
  "MOCK_GPG_FAIL=1"

render_output="$test_root/render-success"
render_arguments_file="$test_root/render-arguments.txt"
render_log="$(
  env \
    "BACKUP_PASSPHRASE=focused-test-passphrase" \
    "DEPLOYED_GIT_SHA=0638ae3aa622b30ed024302106802d32458d3d32" \
    "RENDER_POSTGRES_ID=focused-render-db" \
    "BASELINE_OUTPUT_DIR=$render_output" \
    "RENDER_CLI_BIN=$mock_bin/render" \
    "MOCK_RENDER_ARGUMENTS_FILE=$render_arguments_file" \
    "PSQL_BIN=$mock_bin/psql" \
    "PG_DUMP_BIN=$mock_bin/pg_dump" \
    "PG_RESTORE_BIN=$mock_bin/pg_restore" \
    "GPG_BIN=$mock_bin/gpg" \
    bash "$render_capture_script" 2>&1
)"
if [[ "$render_log" == *"do-not-log"* || "$render_log" == *"focused-test-passphrase"* ]]; then
  echo "Focused baseline test failed: Render capture exposed a credential" >&2
  exit 1
fi
grep -Fx \
  'pg get focused-render-db --include-sensitive-connection-info --output json' \
  "$render_arguments_file" >/dev/null

if [[ "${RUN_BASELINE_DB_TESTS:-0}" == "1" ]]; then
  : "${DATABASE_URL:?DATABASE_URL is required for the database-backed baseline test}"

  integration_output="$test_root/integration"
  integration_passphrase="ci-only-production-baseline-passphrase"
  env \
    DATABASE_URL="$DATABASE_URL" \
    BACKUP_PASSPHRASE="$integration_passphrase" \
    DEPLOYED_GIT_SHA="${GITHUB_SHA:-0638ae3aa622b30ed024302106802d32458d3d32}" \
    SOURCE_DATABASE_ID=ci-postgres \
    BASELINE_OUTPUT_DIR="$integration_output" \
    bash "$capture_script" >/dev/null

  integration_artifact="$(find "$integration_output" -maxdepth 1 -type f -name '*.tar.gz.gpg' -print -quit)"
  [[ -n "$integration_artifact" && -s "$integration_artifact" ]]
  (
    cd "$integration_output"
    sha256sum --check "$(basename "$integration_artifact").sha256" >/dev/null
  )

  decrypted_archive="$test_root/integration.tar.gz"
  printf '%s\n' "$integration_passphrase" | \
    gpg \
      --batch \
      --yes \
      --pinentry-mode loopback \
      --passphrase-fd 0 \
      --decrypt \
      --output "$decrypted_archive" \
      "$integration_artifact" >/dev/null 2>&1

  tar --list --gzip --file "$decrypted_archive" | grep -Fx 'manifest.txt' >/dev/null
  tar --list --gzip --file "$decrypted_archive" | grep -Fx 'production.dump.list' >/dev/null
  tar --list --gzip --file "$decrypted_archive" | grep -Fx 'row-counts.tsv' >/dev/null
  manifest_contents="$(tar --extract --gzip --to-stdout --file "$decrypted_archive" manifest.txt)"
  migrations_contents="$(tar --extract --gzip --to-stdout --file "$decrypted_archive" migrations.tsv)"
  grep -Fx 'applied_migrations=17' <<<"$manifest_contents" >/dev/null
  grep -Fx 'rolled_back_migrations=0' <<<"$manifest_contents" >/dev/null
  grep -Fx 'phase2_contract_migrations=1' <<<"$manifest_contents" >/dev/null
  grep -E '^source_database_version=16(\.|$)' <<<"$manifest_contents" >/dev/null
  grep -F '20260720000000_contract_phase2_normalized_restaurants|' <<<"$migrations_contents" >/dev/null
  [[ "$(wc -l <<<"$migrations_contents" | tr -d ' ')" == "17" ]]
fi

echo "Production baseline focused tests passed"
