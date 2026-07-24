#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUBJECT="${ROOT}/apps/api/scripts/run-release-job.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fail() {
  printf 'not ok - %s\n' "$1" >&2
  exit 1
}

pass() {
  printf 'ok - %s\n' "$1"
}

cat >"$TMP/npm" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >>"$FF57_MOCK_LOG"
if [[ "${FF57_FAIL_COMMAND:-}" == "$*" ]]; then
  exit 42
fi
EOF
chmod 700 "$TMP/npm"

sh -n "$SUBJECT"
pass 'release script syntax'

export FF57_MOCK_LOG="$TMP/success.log"
PATH="$TMP:$PATH" \
  DATABASE_URL='must-not-be-logged' \
  ROOT_ADMIN_USERNAME='must-not-be-logged' \
  sh "$SUBJECT" >"$TMP/success.out" 2>"$TMP/success.err"
cat >"$TMP/expected.log" <<'EOF'
run prisma:migrate:deploy
run prisma:cuisines:seed
run prisma:phones:backfill
run prisma:root:bootstrap
EOF
cmp "$TMP/expected.log" "$FF57_MOCK_LOG" || fail 'release order'
grep -Fq '[ff-57 release] all steps completed' "$TMP/success.out" ||
  fail 'release completion'
if grep -Fq 'must-not-be-logged' "$TMP/success.out" "$TMP/success.err"; then
  fail 'release output leaked environment values'
fi
pass 'ordered release without secret output'

export FF57_MOCK_LOG="$TMP/failure.log"
export FF57_FAIL_COMMAND='run prisma:cuisines:seed'
if PATH="$TMP:$PATH" sh "$SUBJECT" >"$TMP/failure.out" 2>"$TMP/failure.err"; then
  fail 'release failure propagated'
fi
cat >"$TMP/failure-expected.log" <<'EOF'
run prisma:migrate:deploy
run prisma:cuisines:seed
EOF
cmp "$TMP/failure-expected.log" "$FF57_MOCK_LOG" ||
  fail 'release stopped after failing step'
if grep -Fq 'phone-backfill' "$TMP/failure.out" ||
  grep -Fq 'root-admin-bootstrap' "$TMP/failure.out"; then
  fail 'release continued after failure'
fi
pass 'release failure stops subsequent steps'

printf '1..3\n'
