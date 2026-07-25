#!/usr/bin/env bash
set -euo pipefail

WEB_DOMAIN=""
API_DOMAIN=""

usage() {
  cat <<'EOF'
Usage:
  bash scripts/validate-dns-tls.sh --web-domain ff-restaurent.com --api-domain api.ff-restaurent.com
EOF
}

die() {
  printf 'DNS Validation error: %s\n' "$*" >&2
  exit 1
}

log() {
  printf '[validate] %s\n' "$*"
}

while (($#)); do
  case "$1" in
    --web-domain)
      shift
      WEB_DOMAIN="$1"
      ;;
    --api-domain)
      shift
      API_DOMAIN="$1"
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      die "unknown argument: $1"
      ;;
  esac
  shift
done

[[ -n "$WEB_DOMAIN" ]] || die "--web-domain is required"
[[ -n "$API_DOMAIN" ]] || die "--api-domain is required"

log "Checking DNS resolution for ${WEB_DOMAIN}..."
ping -c 1 "$WEB_DOMAIN" >/dev/null 2>&1 || log "Warning: ${WEB_DOMAIN} might not be resolvable yet."

log "Checking DNS resolution for ${API_DOMAIN}..."
ping -c 1 "$API_DOMAIN" >/dev/null 2>&1 || log "Warning: ${API_DOMAIN} might not be resolvable yet."

log "Checking HTTPS for ${WEB_DOMAIN}..."
curl -I -s "https://${WEB_DOMAIN}" >/dev/null || log "Warning: HTTPS for ${WEB_DOMAIN} failed. Cert might still be provisioning."

log "Checking HTTPS for ${API_DOMAIN}..."
curl -I -s "https://${API_DOMAIN}/health" >/dev/null || log "Warning: HTTPS for ${API_DOMAIN} failed. Cert might still be provisioning."

log "DNS and TLS validation script finished."
