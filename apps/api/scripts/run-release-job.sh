#!/bin/sh
set -eu

run_step() {
  step="$1"
  shift
  printf '[ff-57 release] starting %s\n' "$step"
  "$@"
  printf '[ff-57 release] completed %s\n' "$step"
}

run_step prisma-migrate-deploy npm run prisma:migrate:deploy
run_step popular-cuisine-seed npm run prisma:cuisines:seed
run_step phone-backfill npm run prisma:phones:backfill
run_step root-admin-bootstrap npm run prisma:root:bootstrap

printf '[ff-57 release] all steps completed\n'
