#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL is required}"

dump_file="$(mktemp --suffix=.dump)"
source_counts_file="$(mktemp --suffix=.source-counts)"
restore_counts_file="$(mktemp --suffix=.restore-counts)"
snapshot_pid=""

cleanup() {
  if [[ -n "$snapshot_pid" ]]; then
    kill "$snapshot_pid" 2>/dev/null || true
    wait "$snapshot_pid" 2>/dev/null || true
  fi
  rm -f "$dump_file" "$source_counts_file" "$restore_counts_file"
}
trap cleanup EXIT

capture_row_counts() {
  local database_url="$1"
  local output_file="$2"

  psql "$database_url" \
    --set ON_ERROR_STOP=1 \
    --no-align \
    --tuples-only \
    --quiet \
    --field-separator='|' \
    --output="$output_file" <<'SQL'
SELECT format(
  'SELECT %L AS table_name, COUNT(*)::bigint AS row_count FROM %I.%I',
  tablename,
  schemaname,
  tablename
)
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename
\gexec
SQL
}

coproc SOURCE_SNAPSHOT {
  psql "$DATABASE_URL" \
    --no-psqlrc \
    --set ON_ERROR_STOP=1 \
    --no-align \
    --tuples-only \
    --quiet
}
snapshot_pid="$SOURCE_SNAPSHOT_PID"
snapshot_output_fd="${SOURCE_SNAPSHOT[0]}"
snapshot_input_fd="${SOURCE_SNAPSHOT[1]}"

printf '%s\n' \
  'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;' \
  'SELECT pg_export_snapshot();' \
  >&"$snapshot_input_fd"
IFS= read -r dump_snapshot <&"$snapshot_output_fd"

if [[ -z "$dump_snapshot" ]]; then
  echo "Backup restore drill failed: PostgreSQL did not export a dump snapshot" >&2
  exit 1
fi

pg_dump \
  --format=custom \
  --no-owner \
  --no-acl \
  --snapshot="$dump_snapshot" \
  --file="$dump_file" \
  "$DATABASE_URL"

printf '%s\n' \
  "\\o $source_counts_file" \
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
  'COMMIT;' \
  '\q' \
  >&"$snapshot_input_fd"

wait "$snapshot_pid"
snapshot_pid=""

psql "$RESTORE_DATABASE_URL" --set ON_ERROR_STOP=1 <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
SQL
pg_restore --no-owner --no-acl --exit-on-error --dbname="$RESTORE_DATABASE_URL" "$dump_file"
psql "$RESTORE_DATABASE_URL" --set ON_ERROR_STOP=1 --command='SELECT COUNT(*) AS migration_count FROM "_prisma_migrations";'
capture_row_counts "$RESTORE_DATABASE_URL" "$restore_counts_file"

echo "Dump snapshot table row counts"
cat "$source_counts_file"
echo "Restored table row counts"
cat "$restore_counts_file"

if ! diff --unified "$source_counts_file" "$restore_counts_file"; then
  echo "Backup restore drill failed: dump snapshot and restored row counts differ" >&2
  exit 1
fi

echo "Backup restore drill passed"
