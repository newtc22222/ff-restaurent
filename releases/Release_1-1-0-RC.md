# FF RESTaurent 1.1.0 release candidate

Candidate tag: `v1.1.0-rc.1`

Production branch: `main`

Candidate source baseline: `develop` at `3e513f2`

## Purpose

This candidate promotes the complete Phase 2 implementation as a
backward-compatible minor release. It deliberately keeps the FF-38 legacy
restaurant and favorite fields during the production observation window, so
the prior application can still be redeployed before the contract gate.

## Candidate controls

- Workspace packages identify as `1.1.0-rc.1`.
- `.github/workflows/phase2-production-data.yml` runs production dry-run,
  snapshot-consistent recovery rehearsal, applied backfill, and idempotency
  verification as separately auditable operations on `main`.
- Backfill reports and release metadata are retained as GitHub Actions
  artifacts for 30 days; database dumps remain ephemeral and are never
  uploaded.
- Deployment smoke runs on every successful deployment, on manual dispatch,
  and every four hours during the observation window.
- The contract gate remains governed by
  `releases/Phase_2_Migration_Runbook.md`.

## Required candidate sequence

1. Pass repository lint, typecheck, tests, builds, migration deployment, index
   plan verification, and Playwright acceptance coverage.
2. Promote `develop` to `main` through a reviewed pull request.
3. Tag the promoted SHA as `v1.1.0-rc.1` and confirm the deployed health,
   readiness, web, authentication, role, password, phone, and primary Phase 2
   journeys.
4. Dispatch `Phase 2 production data` with `dry-run`; review every exception.
5. Dispatch `Phase 2 production data` with `apply`; retain the recovery log,
   applied report, and immediate repeat report.
6. Observe scheduled smoke evidence for at least 24 hours.
7. Only then prepare the contract migration and final `v1.1.0` release.

This file defines the candidate procedure. Final run IDs, report counts,
production SHA, contract evidence, and recovery evidence belong in
`releases/Release_1-1-0.md` and `.codex/PHASE_2_HANDOFF.md`.
