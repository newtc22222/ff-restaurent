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
render pg delete "$RENDER_DATABASE_ID" || log "Failed or already deleted."

log "Deleting Render API Service ${RENDER_API_SERVICE_ID}..."
render services delete "$RENDER_API_SERVICE_ID" || log "Failed or already deleted."

log "Render resources have been deleted."
