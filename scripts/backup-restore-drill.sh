#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL is required}"

dump_file="$(mktemp --suffix=.dump)"
source_counts_file="$(mktemp --suffix=.source-counts)"
restore_counts_file="$(mktemp --suffix=.restore-counts)"
trap 'rm -f "$dump_file" "$source_counts_file" "$restore_counts_file"' EXIT

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

capture_row_counts "$DATABASE_URL" "$source_counts_file"
pg_dump --format=custom --no-owner --no-acl --file="$dump_file" "$DATABASE_URL"
psql "$RESTORE_DATABASE_URL" --set ON_ERROR_STOP=1 <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
SQL
pg_restore --no-owner --no-acl --exit-on-error --dbname="$RESTORE_DATABASE_URL" "$dump_file"
psql "$RESTORE_DATABASE_URL" --set ON_ERROR_STOP=1 --command='SELECT COUNT(*) AS migration_count FROM "_prisma_migrations";'
capture_row_counts "$RESTORE_DATABASE_URL" "$restore_counts_file"

echo "Source table row counts"
cat "$source_counts_file"
echo "Restored table row counts"
cat "$restore_counts_file"

if ! diff --unified "$source_counts_file" "$restore_counts_file"; then
  echo "Backup restore drill failed: source and restored row counts differ" >&2
  exit 1
fi

echo "Backup restore drill passed"
