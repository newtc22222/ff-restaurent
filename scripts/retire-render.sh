#!/usr/bin/env bash
set -euo pipefail

RENDER_DATABASE_ID="dpg-d9aced58nd3s73aqvhu0-a"
RENDER_API_SERVICE_ID="srv-d9achtd7vvec738us4pg"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/retire-render.sh --apply
EOF
}

die() {
  printf 'Render Decommission error: %s\n' "$*" >&2
  exit 1
}

log() {
  printf '[retire-render] %s\n' "$*"
}

if [[ "${1:-}" != "--apply" ]]; then
  usage
  exit 0
fi

command -v render >/dev/null 2>&1 || die "Render CLI is unavailable"

log "WARNING: This will permanently delete Render services."
printf 'Are you absolutely sure you want to delete Render resources? (Type "yes" to confirm): '
read -r confirm
if [[ "$confirm" != "yes" ]]; then
  die "aborted by operator"
fi

log "Deleting Render Database ${RENDER_DATABASE_ID}..."
if ! out="$(render pg delete "$RENDER_DATABASE_ID" 2>&1)"; then
  if [[ "$out" != *"not found"* && "$out" != *"already deleted"* && "$out" != *"Not Found"* ]]; then
    die "Failed to delete Render Database: $out"
  fi
else
  log "Render Database deleted successfully or already deleted."
fi

log "Deleting Render API Service ${RENDER_API_SERVICE_ID}..."
if ! out="$(render services delete "$RENDER_API_SERVICE_ID" 2>&1)"; then
  if [[ "$out" != *"not found"* && "$out" != *"already deleted"* && "$out" != *"Not Found"* ]]; then
    die "Failed to delete Render API Service: $out"
  fi
else
  log "Render API Service deleted successfully or already deleted."
fi

log "Discovering Render Web Service ID..."
WEB_SERVICE_ID="$(
  render services list --output json 2>/dev/null | python3 -c '
import json, sys
try:
    items = json.load(sys.stdin)
    if isinstance(items, dict):
        items = items.get("data", [])
    for item in items:
        svc = item.get("service", item)
        if svc.get("name") == "ff-restaurent" and svc.get("type") == "static_site":
            print(svc.get("id", ""))
            sys.exit(0)
except Exception:
    pass
print("")
'
)"

if [[ -n "$WEB_SERVICE_ID" ]]; then
  log "Deleting Render Web Service ${WEB_SERVICE_ID}..."
  if ! out="$(render services delete "$WEB_SERVICE_ID" 2>&1)"; then
    if [[ "$out" != *"not found"* && "$out" != *"already deleted"* && "$out" != *"Not Found"* ]]; then
      die "Failed to delete Render Web Service: $out"
    fi
  else
    log "Render Web Service deleted successfully."
  fi
else
  log "Render Web Service 'ff-restaurent' not found or already deleted."
fi

log "Render resources have been deleted."
