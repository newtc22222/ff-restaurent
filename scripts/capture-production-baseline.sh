#!/usr/bin/env bash
set -euo pipefail

umask 077

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE is required}"
: "${DEPLOYED_GIT_SHA:?DEPLOYED_GIT_SHA is required}"
: "${SOURCE_DATABASE_ID:?SOURCE_DATABASE_ID is required}"
: "${BASELINE_OUTPUT_DIR:?BASELINE_OUTPUT_DIR is required}"

database_url="$(
  printf '%s' "$DATABASE_URL" |
    sed -E 's/([?&])schema=[^&]*(&|$)/\1/; s/\?&/?/; s/[?&]$//'
)"
backup_passphrase="$BACKUP_PASSPHRASE"
unset DATABASE_URL
unset BACKUP_PASSPHRASE

if [[ ! "$DEPLOYED_GIT_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Production baseline capture failed: DEPLOYED_GIT_SHA must be a 40-character lowercase Git SHA" >&2
  exit 1
fi

if [[ ! "$SOURCE_DATABASE_ID" =~ ^[A-Za-z0-9._:-]+$ ]]; then
  echo "Production baseline capture failed: SOURCE_DATABASE_ID contains unsupported characters" >&2
  exit 1
fi

PSQL_BIN="${PSQL_BIN:-psql}"
PG_DUMP_BIN="${PG_DUMP_BIN:-pg_dump}"
PG_RESTORE_BIN="${PG_RESTORE_BIN:-pg_restore}"
GPG_BIN="${GPG_BIN:-gpg}"
TAR_BIN="${TAR_BIN:-tar}"
SHA256SUM_BIN="${SHA256SUM_BIN:-sha256sum}"

for command_name in \
  "$PSQL_BIN" \
  "$PG_DUMP_BIN" \
  "$PG_RESTORE_BIN" \
  "$GPG_BIN" \
  "$TAR_BIN" \
  "$SHA256SUM_BIN"; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Production baseline capture failed: required command is unavailable: $command_name" >&2
    exit 1
  fi
done

mkdir -p "$BASELINE_OUTPUT_DIR"
if [[ ! -d "$BASELINE_OUTPUT_DIR" ]]; then
  echo "Production baseline capture failed: BASELINE_OUTPUT_DIR is not a directory" >&2
  exit 1
fi

scratch_dir="$(mktemp -d)"
snapshot_pid=""

cleanup() {
  if [[ -n "$snapshot_pid" ]]; then
    kill "$snapshot_pid" 2>/dev/null || true
    wait "$snapshot_pid" 2>/dev/null || true
  fi
  rm -rf "$scratch_dir"
}
trap cleanup EXIT
trap 'exit 130' HUP INT TERM

dump_file="$scratch_dir/production.dump"
row_counts_file="$scratch_dir/row-counts.tsv"
database_info_file="$scratch_dir/database-info.tsv"
migrations_file="$scratch_dir/migrations.tsv"
migration_summary_file="$scratch_dir/migration-summary.tsv"
dump_list_file="$scratch_dir/production.dump.list"
dump_checksum_file="$scratch_dir/production.dump.sha256"
row_counts_checksum_file="$scratch_dir/row-counts.tsv.sha256"
manifest_file="$scratch_dir/manifest.txt"
archive_file="$scratch_dir/production-baseline.tar.gz"

coproc SOURCE_SNAPSHOT {
  "$PSQL_BIN" "$database_url" \
    --no-psqlrc \
    --set ON_ERROR_STOP=1 \
    --no-align \
    --tuples-only \
    --quiet \
    --field-separator='|'
}
snapshot_pid="$SOURCE_SNAPSHOT_PID"
snapshot_output_fd="${SOURCE_SNAPSHOT[0]}"
snapshot_input_fd="${SOURCE_SNAPSHOT[1]}"

printf '%s\n' \
  'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;' \
  'SELECT pg_export_snapshot();' \
  >&"$snapshot_input_fd"

if ! IFS= read -r dump_snapshot <&"$snapshot_output_fd" || [[ -z "$dump_snapshot" ]]; then
  echo "Production baseline capture failed: PostgreSQL did not export a snapshot" >&2
  exit 1
fi

if ! "$PG_DUMP_BIN" \
  --format=custom \
  --no-owner \
  --no-acl \
  --snapshot="$dump_snapshot" \
  --file="$dump_file" \
  "$database_url"; then
  echo "Production baseline capture failed: pg_dump failed" >&2
  exit 1
fi

printf '%s\n' \
  "\\o $row_counts_file" \
  "SELECT format(" \
  "  'SELECT %L AS table_name, COUNT(*)::bigint AS row_count FROM %I.%I'," \
  "  tablename," \
  "  schemaname," \
  "  tablename" \
  ")" \
  "FROM pg_tables" \
  "WHERE schemaname = 'public'" \
  "ORDER BY tablename" \
  "\\gexec" \
  '\o' \
  "\\o $database_info_file" \
  "SELECT current_setting('server_version') || '|' || current_database();" \
  '\o' \
  "\\o $migrations_file" \
  "SELECT migration_name || '|' ||" \
  "  COALESCE(to_char(finished_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"'), '') || '|' ||" \
  "  COALESCE(to_char(rolled_back_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"'), '')" \
  'FROM "_prisma_migrations"' \
  'ORDER BY started_at;' \
  '\o' \
  "\\o $migration_summary_file" \
  "SELECT (COUNT(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL))::text || '|' ||" \
  "  (COUNT(*) FILTER (WHERE rolled_back_at IS NOT NULL))::text || '|' ||" \
  "  (COUNT(*) FILTER (WHERE migration_name = '20260720000000_contract_phase2_normalized_restaurants'" \
  "    AND finished_at IS NOT NULL AND rolled_back_at IS NULL))::text" \
  'FROM "_prisma_migrations";' \
  '\o' \
  'COMMIT;' \
  '\q' \
  >&"$snapshot_input_fd"

wait "$snapshot_pid"
snapshot_pid=""

for evidence_file in \
  "$dump_file" \
  "$row_counts_file" \
  "$database_info_file" \
  "$migrations_file" \
  "$migration_summary_file"; do
  if [[ ! -s "$evidence_file" ]]; then
    echo "Production baseline capture failed: expected evidence was not produced" >&2
    exit 1
  fi
done

IFS='|' read -r server_version database_name <"$database_info_file"
IFS='|' read -r applied_migrations rolled_back_migrations phase2_contract_migrations <"$migration_summary_file"

if [[ "$applied_migrations" != "17" || "$rolled_back_migrations" != "0" || "$phase2_contract_migrations" != "1" ]]; then
  echo "Production baseline capture failed: migration state does not match the released Phase 2 boundary" >&2
  exit 1
fi

if [[ "$(wc -l <"$migrations_file" | tr -d ' ')" != "17" ]]; then
  echo "Production baseline capture failed: migration inventory does not contain exactly 17 rows" >&2
  exit 1
fi

if ! "$PG_RESTORE_BIN" --list "$dump_file" >"$dump_list_file"; then
  echo "Production baseline capture failed: pg_restore could not list the dump" >&2
  exit 1
fi
if [[ ! -s "$dump_list_file" ]]; then
  echo "Production baseline capture failed: pg_restore did not produce an integrity listing" >&2
  exit 1
fi

(
  cd "$scratch_dir"
  "$SHA256SUM_BIN" production.dump >"$(basename "$dump_checksum_file")"
  "$SHA256SUM_BIN" row-counts.tsv >"$(basename "$row_counts_checksum_file")"
)

dump_sha256="$(cut -d' ' -f1 "$dump_checksum_file")"
row_counts_sha256="$(cut -d' ' -f1 "$row_counts_checksum_file")"
captured_at_utc="$(date --utc '+%Y-%m-%dT%H:%M:%SZ')"
filename_timestamp="$(date --utc '+%Y%m%dT%H%M%SZ')"

cat >"$manifest_file" <<EOF
format_version=1
captured_at_utc=$captured_at_utc
source_provider=render
source_database_id=$SOURCE_DATABASE_ID
source_database_name=$database_name
source_database_version=$server_version
source_deployed_git_sha=$DEPLOYED_GIT_SHA
snapshot_strategy=repeatable-read-exported-snapshot
applied_migrations=$applied_migrations
rolled_back_migrations=$rolled_back_migrations
phase2_contract_migrations=$phase2_contract_migrations
dump_sha256=$dump_sha256
row_counts_sha256=$row_counts_sha256
EOF

"$TAR_BIN" \
  --create \
  --gzip \
  --file "$archive_file" \
  --directory "$scratch_dir" \
  manifest.txt \
  production.dump \
  production.dump.list \
  production.dump.sha256 \
  row-counts.tsv \
  row-counts.tsv.sha256 \
  database-info.tsv \
  migrations.tsv \
  migration-summary.tsv

artifact_name="ff-restaurent-production-baseline-$filename_timestamp.tar.gz.gpg"
encrypted_file="$scratch_dir/$artifact_name"

if ! printf '%s\n' "$backup_passphrase" | \
  "$GPG_BIN" \
    --batch \
    --yes \
    --pinentry-mode loopback \
    --passphrase-fd 0 \
    --symmetric \
    --cipher-algo AES256 \
    --s2k-digest-algo SHA512 \
    --output "$encrypted_file" \
    "$archive_file"; then
  echo "Production baseline capture failed: GPG encryption failed" >&2
  exit 1
fi
unset backup_passphrase

if [[ ! -s "$encrypted_file" ]]; then
  echo "Production baseline capture failed: encrypted artifact was not produced" >&2
  exit 1
fi

final_artifact="$BASELINE_OUTPUT_DIR/$artifact_name"
final_checksum="$final_artifact.sha256"
install -m 600 "$encrypted_file" "$final_artifact"
(
  cd "$BASELINE_OUTPUT_DIR"
  "$SHA256SUM_BIN" "$artifact_name" >"$(basename "$final_checksum")"
)
encrypted_sha256="$(cut -d' ' -f1 "$final_checksum")"

if [[ -n "${CAPTURE_OUTPUT_FILE:-}" ]]; then
  {
    echo "artifact_name=$artifact_name"
    echo "artifact_path=$final_artifact"
    echo "checksum_path=$final_checksum"
    echo "encrypted_sha256=$encrypted_sha256"
    echo "captured_at_utc=$captured_at_utc"
    echo "deployed_git_sha=$DEPLOYED_GIT_SHA"
  } >>"$CAPTURE_OUTPUT_FILE"
fi

echo "Production baseline capture completed"
echo "Encrypted artifact: $final_artifact"
echo "Encrypted SHA-256: $encrypted_sha256"
echo "Captured at: $captured_at_utc"
