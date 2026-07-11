#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL is required}"

dump_file="$(mktemp --suffix=.dump)"
trap 'rm -f "$dump_file"' EXIT

pg_dump --format=custom --no-owner --no-acl --file="$dump_file" "$DATABASE_URL"
psql "$RESTORE_DATABASE_URL" --set ON_ERROR_STOP=1 <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
SQL
pg_restore --no-owner --no-acl --exit-on-error --dbname="$RESTORE_DATABASE_URL" "$dump_file"
psql "$RESTORE_DATABASE_URL" --set ON_ERROR_STOP=1 --command='SELECT COUNT(*) AS migration_count FROM "_prisma_migrations";'

echo "Backup restore drill passed"
