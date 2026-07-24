#!/usr/bin/env bash
set -euo pipefail

if [[ "${RUN_FF58_DB_TESTS:-0}" != "1" ]]; then
  echo "FF-58 PostgreSQL integration skipped (set RUN_FF58_DB_TESTS=1)"
  exit 0
fi

: "${DATABASE_URL:?DATABASE_URL is required}"

for command_name in psql pg_dump pg_restore gpg tar sha256sum python3; do
  command -v "$command_name" >/dev/null 2>&1 || {
    echo "FF-58 integration requires ${command_name}" >&2
    exit 1
  }
done

[[ "$(psql --version)" == *" 16."* ]]
[[ "$(pg_dump --version)" == *" 16."* ]]
[[ "$(pg_restore --version)" == *" 16."* ]]

test_root="$(mktemp -d)"
source_database="ff58_rehearsal_source"
target_database="ff58_rehearsal_target"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repository_root="$(cd "${script_dir}/.." && pwd)"
passphrase="ci-only-ff58-integration-passphrase"

npm_cmd() {
  if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    command npm "$@"
  else
    NPM_CONFIG_SCRIPT_SHELL='C:\Program Files\Git\bin\bash.exe'
    export NPM_CONFIG_SCRIPT_SHELL
    local bridge_environment="${WSLENV:-}"
    local name suffix
    for name in \
      DATABASE_URL \
      ROOT_ADMIN_USERNAME \
      MIGRATION_REHEARSAL_REPORT_PATH \
      NPM_CONFIG_SCRIPT_SHELL; do
      [[ -v "$name" ]] || continue
      suffix=""
      [[ "$name" == "MIGRATION_REHEARSAL_REPORT_PATH" ]] && suffix="/p"
      bridge_environment="${bridge_environment:+${bridge_environment}:}${name}${suffix}"
    done
    WSLENV="$bridge_environment" \
      /mnt/c/Windows/System32/cmd.exe /d /c npm.cmd "$@"
  fi
}

database_url_for() {
  DATABASE_NAME="$1" python3 -c '
import os
from urllib.parse import urlsplit, urlunsplit

parts = urlsplit(os.environ["DATABASE_URL"])
print(urlunsplit((parts.scheme, parts.netloc, "/" + os.environ["DATABASE_NAME"], parts.query, parts.fragment)))
'
}

postgres_url_for() {
  DATABASE_NAME="$1" python3 -c '
import os
from urllib.parse import urlsplit, urlunsplit

parts = urlsplit(os.environ["DATABASE_URL"])
print(urlunsplit((parts.scheme, parts.netloc, "/" + os.environ["DATABASE_NAME"], "", "")))
'
}

admin_url="$(postgres_url_for postgres)"
source_url="$(database_url_for "$source_database")"
target_url="$(database_url_for "$target_database")"
source_postgres_url="$(postgres_url_for "$source_database")"
target_postgres_url="$(postgres_url_for "$target_database")"

cleanup() {
  psql "$admin_url" --no-psqlrc --set ON_ERROR_STOP=1 \
    --command="DROP DATABASE IF EXISTS ${target_database} WITH (FORCE)" \
    >/dev/null 2>&1 || true
  psql "$admin_url" --no-psqlrc --set ON_ERROR_STOP=1 \
    --command="DROP DATABASE IF EXISTS ${source_database} WITH (FORCE)" \
    >/dev/null 2>&1 || true
  rm -rf "$test_root"
}
trap cleanup EXIT

psql "$admin_url" --no-psqlrc --set ON_ERROR_STOP=1 \
  --command="DROP DATABASE IF EXISTS ${source_database} WITH (FORCE)" >/dev/null
psql "$admin_url" --no-psqlrc --set ON_ERROR_STOP=1 \
  --command="CREATE DATABASE ${source_database}" >/dev/null

(
  cd "$repository_root"
  DATABASE_URL="$source_url" npm_cmd run prisma:migrate:deploy -w @ff-restaurent/api \
    >/dev/null
  DATABASE_URL="$source_url" npm_cmd run prisma:cuisines:seed -w @ff-restaurent/api \
    >/dev/null
)

psql "$source_postgres_url" --no-psqlrc --set ON_ERROR_STOP=1 >/dev/null <<'SQL'
INSERT INTO "User" (
  "id", "username", "name", "searchText", "passwordHash", "systemRole",
  "createdAt", "updatedAt"
) VALUES (
  'ff58-root', 'ff58-root', 'FF58 Root', 'ff58 root',
  'not-a-login-credential', 'ROOT_ADMIN', NOW(), NOW()
);
INSERT INTO "Collection" (
  "id", "name", "searchText", "isPublic", "systemType", "ownerId",
  "createdAt", "updatedAt"
) VALUES
  (
    'ff58-favorites', 'Favorites', 'favorites', false, 'FAVORITES',
    'ff58-root', NOW(), NOW()
  );
SQL

capture_output="$test_root/capture-output.txt"
mkdir "$test_root/capture-scripts"
sed 's/\r$//' "$script_dir/capture-production-baseline.sh" \
  >"$test_root/capture-scripts/capture-production-baseline.sh"
chmod 700 "$test_root/capture-scripts/capture-production-baseline.sh"
DATABASE_URL="$source_url" \
  BACKUP_PASSPHRASE="$passphrase" \
  DEPLOYED_GIT_SHA="${GITHUB_SHA:-2034a652cfa2707e11b88321e508cc5e05ed9801}" \
  SOURCE_DATABASE_ID=ff58-postgres16-fixture \
  BASELINE_OUTPUT_DIR="$test_root/capture" \
  CAPTURE_OUTPUT_FILE="$capture_output" \
  bash "$test_root/capture-scripts/capture-production-baseline.sh" >/dev/null

artifact_path="$(sed -n 's/^artifact_path=//p' "$capture_output")"
(
  cd "$(dirname "$artifact_path")"
  sha256sum --check "$(basename "$artifact_path").sha256" >/dev/null
)
printf '%s\n' "$passphrase" |
  gpg --batch --yes --pinentry-mode loopback --passphrase-fd 0 \
    --decrypt --output "$test_root/source.tar.gz" "$artifact_path" \
    >/dev/null 2>&1
mkdir "$test_root/source"
tar --extract --gzip --file "$test_root/source.tar.gz" \
  --directory "$test_root/source"

run_pass() {
  local pass="$1"
  psql "$admin_url" --no-psqlrc --set ON_ERROR_STOP=1 \
    --command="DROP DATABASE IF EXISTS ${target_database} WITH (FORCE)" \
    >/dev/null
  psql "$admin_url" --no-psqlrc --set ON_ERROR_STOP=1 \
    --command="CREATE DATABASE ${target_database}" >/dev/null
  pg_restore --no-owner --no-acl --exit-on-error --single-transaction \
    --dbname "$target_postgres_url" "$test_root/source/production.dump" >/dev/null

  psql "$target_postgres_url" --no-psqlrc --set ON_ERROR_STOP=1 \
    --no-align --tuples-only --quiet \
    --command="SELECT format('SELECT %L AS table_name, COUNT(*)::bigint AS row_count FROM %I.%I;', tablename, schemaname, tablename) FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename" |
    psql "$target_postgres_url" --no-psqlrc --set ON_ERROR_STOP=1 \
      --no-align --tuples-only --quiet >"$test_root/counts-before-${pass}.tsv"
  cmp --silent "$test_root/source/row-counts.tsv" \
    "$test_root/counts-before-${pass}.tsv"

  (
    cd "$repository_root"
    DATABASE_URL="$target_url" ROOT_ADMIN_USERNAME=ff58-root \
      npm_cmd run release:run -w @ff-restaurent/api >/dev/null
    DATABASE_URL="$target_url" \
      MIGRATION_REHEARSAL_REPORT_PATH="$test_root/invariants-${pass}.json" \
      npm_cmd run prisma:migration:verify -w @ff-restaurent/api >/dev/null
  )

  psql "$target_postgres_url" --no-psqlrc --set ON_ERROR_STOP=1 \
    --no-align --tuples-only --quiet \
    --command="SELECT format('SELECT %L AS table_name, COUNT(*)::bigint AS row_count FROM %I.%I;', tablename, schemaname, tablename) FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename" |
    psql "$target_postgres_url" --no-psqlrc --set ON_ERROR_STOP=1 \
      --no-align --tuples-only --quiet >"$test_root/counts-after-${pass}.tsv"
  cmp --silent "$test_root/counts-before-${pass}.tsv" \
    "$test_root/counts-after-${pass}.tsv"
}

run_pass 1
run_pass 2

python3 - "$test_root/invariants-1.json" \
  "$test_root/invariants-2.json" <<'PY'
import json
import sys

def stable(path):
    with open(path, encoding="utf-8") as handle:
        value = json.load(handle)
    value.pop("checkedAt", None)
    return value

if stable(sys.argv[1]) != stable(sys.argv[2]):
    raise SystemExit("FF-58 invariant report changed between restore passes")
PY

echo "FF-58 PostgreSQL 16 two-pass integration passed"
