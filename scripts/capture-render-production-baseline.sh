#!/usr/bin/env bash
set -euo pipefail

: "${RENDER_POSTGRES_ID:?RENDER_POSTGRES_ID is required}"

RENDER_CLI_BIN="${RENDER_CLI_BIN:-render}"
PYTHON_BIN="${PYTHON_BIN:-python3}"

if ! command -v "$RENDER_CLI_BIN" >/dev/null 2>&1; then
  echo "Render production baseline capture failed: Render CLI is unavailable" >&2
  exit 1
fi

if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  echo "Render production baseline capture failed: Python is unavailable" >&2
  exit 1
fi

database_url="$(
  "$RENDER_CLI_BIN" pg get "$RENDER_POSTGRES_ID" \
    --include-sensitive-connection-info \
    --output json |
    "$PYTHON_BIN" -c '
import json
import sys

payload = json.load(sys.stdin)
database_url = payload.get("data", {}).get("connectionInfo", {}).get("externalConnectionString")
if not database_url:
    raise SystemExit("Render CLI did not return an external connection string")
sys.stdout.write(database_url)
'
)"

if [[ -z "$database_url" ]]; then
  echo "Render production baseline capture failed: Render CLI returned an empty connection string" >&2
  exit 1
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
set +e
DATABASE_URL="$database_url" \
  SOURCE_DATABASE_ID="$RENDER_POSTGRES_ID" \
  bash "$script_dir/capture-production-baseline.sh"
capture_status=$?
set -e
unset database_url
exit "$capture_status"
