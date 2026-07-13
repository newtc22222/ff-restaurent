# Phase 1 Handoff

Last updated: 2026-07-13

## Resume here

Phase 1 / version 1.0.0 implementation is complete and was pushed to
`origin/develop`. The current published commit at the tip of `develop` is
`09bc3c15f379b8fe341ed7fc64161358040aba46`.

The original Phase 1 release-documentation boundary remains
`2c1f3d86a4efc834e4774170bda969151a4148cd`. Subsequent commits on `develop`
contain configuration, app-shell, routing, scrolling, bill-form, filtering,
header, and reusable dropdown improvements made after that boundary.

Read these files before continuing release or Phase 2 work:

- `releases/Release_1-0-0.md` — shipped scope, API changes, configuration, and
  verification record.
- `releases/PRE_RELEASE.md` — release-readiness checklist.
- `docs/03_PRODUCTION_RUNBOOK.md` — deployment, rollback, smoke, and recovery
  procedures.
- `AGENTS.md` and `.codex/skills/ff-restaurent-app/SKILL.md` — repository rules
  and commands.

## Published Phase 1 commits

- `0aa4f38` — `feat(api): harden phase 1 security and settlement`
- `bef5cd2` — `feat(web): complete phase 1 payment and notification flows`
- `c546bdc` — `test(ci): enforce phase 1 release gates`
- `2c1f3d8` — `docs(release): document version 1.0.0`

## Published post-release updates

- `7ccfa0d` — `feat(api): add dotenv support and configure API settings`
- `b5092cf` — `docs: update AGENTS.md and add PHASE_1_HANDOFF.md for Phase 1 release guidance`
- `9b6aa48` — `Refine bill screens and create form controls`
- `1e7b8c8` — `feat(web): add custom application scrollbars`
- `3b8138b` — `feat(web): migrate to react-router v7 data router`
- `cd53144` — `refactor(web): restructure src into app/pages/components/hooks/lib layers`
- `78e77a9` — `feat: add codex configuration with workspace-write sandbox mode enabled`
- `6cebd0d` — `refactor(web): remove JavaScript import extensions`
- `09bc3c1` — `feat(web): refine app shell and selection controls`

The `develop` branch tracks `origin/develop`. Do not recreate or squash these
commits unless explicitly requested.

## Completed scope

- Invite-gated registration, production JWT/CORS hardening, auth rate limits,
  and protected role administration.
- Public-user response contracts that prevent password-hash serialization.
- Settlement-safe bill editing, optimistic payment updates and corrections,
  participant/payment audit events, and reminder cooldown/ownership checks.
- Authoritative bill preview, multiple discounts, voucher codes, payment links,
  notification navigation, and resilient session refresh behavior.
- PostgreSQL integration coverage, Playwright launch journeys, readiness probe,
  staging smoke workflow, backup/restore drill workflow, and production runbook.
- Prisma migration `20260711000000_add_payment_url`.

## Verification evidence

The published Phase 1 state passed:

- lint and typecheck across all workspaces;
- production builds for API, web, and shared;
- 7/7 API tests using disposable PostgreSQL;
- 4/4 shared bill-splitting tests;
- Customer, Sous Chef, Head Chef, and 390px-mobile Playwright journeys;
- authenticated staging smoke;
- Prisma validation and migrations.

The default `npm test` command skips five database-dependent API integration
tests unless the integration-test environment is enabled. Two API contract
tests and all four shared tests pass in the default run. Vite reports a
non-blocking chunk-size advisory.

## Remaining Phase 1 release operation

The code phase is complete, but production promotion is not complete. Linear
issues `FF-5` through `FF-20` were completed; `FF-21` remained in progress
pending protected production/staging secrets and a recorded successful
backup/restore drill.

Before promoting 1.0.0:

1. Configure the protected secrets listed in the runbook.
2. Run and record the backup/restore drill.
3. Apply `prisma migrate deploy` as the release migration job.
4. Deploy API, verify `/health` and `/ready`, then deploy web.
5. Run the authenticated staging smoke and monitor launch events.
6. Mark `FF-21` done only after the recovery evidence exists.

## Important current worktree boundary

Before this handoff-only edit, `develop` and `origin/develop` both pointed to
`09bc3c15f379b8fe341ed7fc64161358040aba46`, and the worktree was clean. The
only expected uncommitted change is this document; there are no known
uncommitted application changes to preserve.

## Suggested next-chat opening checks

```powershell
git status -sb
git log -5 --oneline
git diff --stat
```

Then confirm whether the requested work is the remaining 1.0.0 production
operation, the existing post-release work-in-progress, or Phase 2.
