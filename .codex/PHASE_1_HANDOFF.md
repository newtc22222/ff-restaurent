# Phase 1 Handoff

Last updated: 2026-07-16

## Resume here

Phase 1 / version 1.0.0 is operationally complete. The release was promoted to
`main`, the production recovery drill and authenticated staging smoke both
passed, and Linear issue `FF-21` is Done.

Phase 2 implementation is also complete on `develop` at `3e513f2` after PRs
#11–#28. The Linear milestone `Phase 2 — Reliability & Retention` is at 100%,
while the overall roadmap remains In Progress for Phases 3–4. Release work is
now preparing the backward-compatible `v1.1.0-rc.1` expand/backfill candidate;
the FF-38 contract migration remains gated by its 24-hour observation window.

Read these files before starting Phase 2 or another production operation:

- `releases/Release_1-0-0.md` — shipped scope, API changes, configuration, and
  the release verification record.
- `releases/PRE_RELEASE.md` — release-readiness checklist.
- `docs/03_PRODUCTION_RUNBOOK.md` — deployment, rollback, smoke, and recovery
  procedures.
- `AGENTS.md` and `.codex/skills/ff-restaurent-app/SKILL.md` — repository rules
  and commands.

## Final Phase 1 boundaries

- Release tag: annotated `v1.0.0`.
- Tagged release commit: `951922d488aecfbee4029b95a7f049a309f96915`.
- Current production `origin/main`: `a8b6df3733f19d1777634997981f205d6a8207ca`
  (`Merge pull request #10 from newtc22222/develop`).
- Phase 1 code and recovery-script baseline on `origin/develop`:
  `dbf910baf0a75b4c0182a0cd281707aec5dc2cf5`.
- `origin/main` and `origin/develop` have the same file content at these two
  commits; the different SHA is the reviewed merge commit on `main`.

The recovery-verification commits merged after the tag are:

- `1817169` — `ci: strengthen release recovery verification`.
- `dbf910b` — `ci: use dump snapshot for restore counts`.

The final script captures expected table counts from the same exported,
repeatable-read PostgreSQL snapshot used by `pg_dump`, preventing production
writes from racing the restored row-count comparison.

## Production recovery evidence

Accepted backup/restore drill:

- GitHub Actions run:
  https://github.com/newtc22222/ff-restaurent/actions/runs/29354488513
- Workflow: `Backup restore drill`, manually dispatched by `newtc22222`.
- Source branch/commit: `main` at
  `a8b6df3733f19d1777634997981f205d6a8207ca`.
- Started: `2026-07-14T17:36:37Z` (`2026-07-15 00:36:37` Asia/Saigon).
- Completed: `2026-07-14T17:37:28Z`; conclusion `success` on attempt 1.
- Source: a custom-format logical dump of the database configured by the
  protected `PRODUCTION_DATABASE_URL`, using an exported dump snapshot.
- Restored migration count: `3`.
- Dump-snapshot and restored table counts matched exactly:

  | Table                | Snapshot | Restored |
  | -------------------- | -------: | -------: |
  | `Bill`               |        0 |        0 |
  | `BillAuditLog`       |        0 |        0 |
  | `BillParticipant`    |        0 |        0 |
  | `Notification`       |        0 |        0 |
  | `RestaurantEntry`    |        0 |        0 |
  | `RoleAuditLog`       |        4 |        4 |
  | `User`               |        4 |        4 |
  | `UserFavorite`       |        0 |        0 |
  | `_prisma_migrations` |        3 |        3 |

The isolated restore completed without errors and printed
`Backup restore drill passed`.

Accepted deployment smoke:

- GitHub Actions run:
  https://github.com/newtc22222/ff-restaurent/actions/runs/29354547843
- Workflow: `Staging smoke`, triggered by successful deployment status.
- Source commit: `a8b6df3733f19d1777634997981f205d6a8207ca`.
- Started: `2026-07-14T17:37:31Z` (`2026-07-15 00:37:31` Asia/Saigon).
- Completed: `2026-07-14T17:37:52Z`; conclusion `success` on attempt 1.
- Verified API `/health` and `/ready`, the web URL, authenticated login, `/me`,
  `/bills`, and `/notifications`.

## Completed scope

- Invite-gated registration, production JWT/CORS hardening, auth rate limits,
  and protected role administration.
- Public-user response contracts that prevent password-hash serialization.
- Settlement-safe bill editing, optimistic payment updates and corrections,
  participant/payment audit events, and reminder cooldown/ownership checks.
- Authoritative bill preview, multiple discounts, voucher codes, payment links,
  notification navigation, and resilient session refresh behavior.
- React Router Data Mode, direct-route hosting support, fixed application shell,
  themed searchable dropdowns, bilingual UI, and production warm-up/load
  optimizations.
- PostgreSQL integration coverage, Playwright launch journeys, readiness probe,
  staging smoke workflow, backup/restore drill workflow, and production runbook.
- Prisma migration `20260711000000_add_payment_url`.

## Verification summary

The Phase 1 release gates passed:

- lint and typecheck across all workspaces;
- production builds for API, web, and shared;
- 7/7 API tests using disposable PostgreSQL;
- 4/4 shared bill-splitting tests;
- Customer, Sous Chef, Head Chef, and 390px-mobile Playwright journeys;
- Prisma validation and migrations;
- production backup/restore with migration and row-count verification;
- deployed health, readiness, web, authentication, bills, and notifications
  smoke checks.

The default `npm test` command skips five database-dependent API integration
tests unless the integration-test environment is enabled. Two API contract
tests and all four shared tests pass in the default run. Vite reports a
non-blocking chunk-size advisory. Render Free services can still introduce a
cold-start delay after idle periods.

## Linear closure

- `FF-5` through `FF-21` are complete.
- `FF-21` (`Complete production readiness and rollback controls`) returned to
  Done at `2026-07-14T17:55:36Z`, after the recovery and staging evidence was
  recorded.
- Phase 1C — Release Readiness is complete.
- The overall `FF RESTaurent — Product Maturity Roadmap` remains active because
  Phase 2 and later milestones remain open.

## Phase 2 delivery workflow

The ticket workflow below is complete through FF-27. Do not start another
Phase 2 feature ticket; resume from `releases/Phase_2_Migration_Runbook.md` and
the `v1.1.0-rc.1` release boundary.

Before starting a Phase 2 ticket:

```powershell
git status -sb
git fetch origin --prune
git switch develop
git pull --ff-only origin develop
```

Then:

1. Select the next unblocked Phase 2 Linear ticket.
2. Create one branch per feature from the updated `origin/develop` using
   `feature/ff-<issue-number>-<short-slug>`.
3. Keep the ticket's implementation and tests scoped to that branch.
4. Open a PR into `develop`, require CI, squash-merge, and delete the feature
   branch after merge.
5. Promote releases through a reviewed `develop` → `main` PR. Production
   deploys only from `main`; do not push feature work directly to `main`.

Phase 2 planned scope includes scalable search and pagination, enriched
restaurant profiles, Cuisine and Dining Area catalogs, Collections, Feedback,
structured Vietnamese addresses, and responsive member administration.
