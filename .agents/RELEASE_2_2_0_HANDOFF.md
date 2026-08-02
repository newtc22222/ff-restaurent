# Gemini handoff: release v2.2.0 to production

Last verified: 2026-08-02 (Asia/Saigon)

## Objective and authority boundary

Prepare, review, and promote FF RESTaurent `v2.2.0` from `develop` to `main`,
configure production to reuse the existing Firebase project, verify the GCP
release, then tag and publish it.

This document records a point-in-time snapshot. Refresh every Git, GitHub,
Linear, GCP, and workflow fact before acting. Do not use a stale SHA, revision,
run, issue state, or environment-variable result merely because it appears
here.

The handoff commit itself does not authorize a direct push to `develop` or
`main`, production configuration before the release preflight, a deployment,
tag creation, or release publication. Use reviewed pull requests and stop on a
failed gate.

Preserve unrelated worktrees and local changes. Continue in the isolated
`codex/v2.2.0-release-handoff` worktree, or create another isolated worktree
from the refreshed `origin/develop`. Never reset or clean a user-owned
checkout.

## Verified release boundary

| Item                          | Verified state                                                           |
| ----------------------------- | ------------------------------------------------------------------------ |
| Repository                    | `newtc22222/ff-restaurent`                                               |
| Production branch and release | `origin/main` and `v2.1.0` at `e58839614daae20c5f2ab4c0d99d52bbf563dd79` |
| Candidate branch              | `origin/develop` at `747f65a7c5d156f0340cff9e790fca881ac34ad6`           |
| Branch relationship           | `develop` is 40 commits ahead and one release-merge commit behind `main` |
| Production migrations         | 19 migration files                                                       |
| Candidate migrations          | 22 migration files                                                       |
| Latest candidate deploy       | GCP deploy run `30753257660`, passed                                     |
| Latest candidate smoke        | Staging smoke run `30753486718`, passed                                  |
| Latest staging API revision   | `ff-restaurent-api-staging-00055-c4t`                                    |
| Latest staging web revision   | `ff-restaurent-web-staging-00052-jf6`                                    |
| Current production deploy     | GCP deploy run `30503930598`, passed for `v2.1.0`                        |

The one commit behind is the previous `develop` to `main` release merge. Do not
rebase `develop` onto `main` merely to make the graph linear. Promote through a
reviewed `develop` to `main` pull request, following the established release
workflow.

The four most recent release-relevant merged pull requests are:

- [#89](https://github.com/newtc22222/ff-restaurent/pull/89), which made the
  Firebase project-ID transition idempotent and added the cuisine seed to the
  blocking release job. CI passed in run `30744341479`.
- [#90](https://github.com/newtc22222/ff-restaurent/pull/90), which added the
  authenticated SSE notification inbox and hardened stream lifetime and
  reconnect backoff. CI passed in run `30749967629`.
- [#91](https://github.com/newtc22222/ff-restaurent/pull/91), which added the
  saffron, basil, and chili accent preference. CI passed in run `30750865577`.
- [#93](https://github.com/newtc22222/ff-restaurent/pull/93), which moved
  language, theme, and accent controls into Settings and added the application
  information dialog and login introduction footer. It added no migration or
  environment variable. CI passed in run `30753068295`.

Release notes must cover the complete delta since `v2.1.0`, not only these
four pull requests. That delta includes the Phase 2C product polish and
catalog work, mobile navigation and responsive list improvements, local
translation hooks, caching, managed dining-area images, platform-link colors,
the Drinks cuisine seed, FCM payment reminders, product-event notifications,
notification reliability, notification-click tab reuse, the real-time inbox,
accent selection, the consolidated Settings experience, application
information dialog, and login introduction footer.

The three new migrations are:

- `20260727000000_add_push_subscriptions`
- `20260730100000_add_dining_area_images`
- `20260801090000_product_event_notifications`

The blocking release job runs migrations, the idempotent popular-cuisine seed,
phone normalization, and ROOT_ADMIN bootstrap in that order.

## Refresh before release preparation

Run read-only checks first and replace the snapshot above with current facts:

```powershell
git status --short --branch
git fetch origin --tags --prune
git rev-parse origin/develop
git rev-parse origin/main
git merge-base origin/main origin/develop
git rev-list --left-right --count origin/main...origin/develop
gh pr list --repo newtc22222/ff-restaurent --state open
gh run list --repo newtc22222/ff-restaurent --branch develop --limit 10
gcloud config get-value project
gcloud config get-value account
gcloud run services list --project ff-restaurent --region asia-east1
```

Before changing files, confirm:

- `origin/develop` contains PRs #89, #90, #91, and #93 and has no newer
  unreviewed release blocker.
- The release worktree is clean and based on the refreshed `origin/develop`.
- There is no competing release pull request or `v2.2.0` tag.
- The active GCP project is exactly `ff-restaurent` and the intended operator
  account is active.
- The latest staging deployment and staging smoke for the candidate SHA are
  green.
- FF-46 remains Backlog under `Phase 3 — Advanced Automation`; do not implement
  or redesign it during this release.

If `origin/develop` advanced, incorporate the handoff commit onto a fresh
release branch from that new boundary. Do not discard the newer work or force
the old snapshot.

## Prepare v2.2.0

Use one release-preparation branch based on the refreshed `origin/develop`.
Keep release-only edits separate from product changes.

1. Set version `2.2.0` in:
   - the root `package.json`
   - `apps/api/package.json`
   - `apps/web/package.json`
   - `packages/shared/package.json`
   - the root and workspace metadata in `package-lock.json`
2. Set both internal `@ff-restaurent/shared` dependency versions to `2.2.0` in
   the API and web packages and regenerate lockfile metadata with npm.
3. Confirm no release metadata still points to `2.1.0`, except historical
   release documentation.
4. Create `Release-v2.2.0.md` in the separate
   `ff-restaurent.wiki` repository. Include the full `v2.1.0..develop` scope,
   the three migrations, Firebase setup, verification evidence, rollback
   boundary, and links to the release PR and workflows.
5. Update any repository release-stage pointer that would otherwise describe
   Phase 2.5 or `v2.1.0` as the current boundary. Preserve historical release
   records rather than rewriting them.

Use the previous `v2.1.0` release preparation and Wiki page as structural
references. Do not tag as part of version preparation.

## Configure production Firebase before merging to main

This configuration is a hard pre-merge gate because a push to `main`
automatically builds and deploys production. If the variables are absent at
that moment, the Vite build bakes an unconfigured Firebase client into the web
image.

Phase 2C and the Phase 2D SSE inbox need no new environment variables. FCM is
the only new production configuration.

At the verified snapshot:

- GitHub Environment `staging` contains all five Firebase web variables.
- GitHub Environment `production` contains none of them.
- Staging Cloud Run API has `FIREBASE_PROJECT_ID`.
- Production Cloud Run API does not yet have `FIREBASE_PROJECT_ID`.
- Both API services use
  `ff-runtime@ff-restaurent.iam.gserviceaccount.com` in project
  `ff-restaurent`.

Reuse the existing Firebase project and VAPID key. Do not create another
Firebase project, web app, service-account JSON key, API secret, or a
`VITE_`-prefixed server credential.

Copy these exact GitHub Environment variables from `staging` to `production`:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_VAPID_KEY`

The values are Firebase public web configuration but must still not be pasted
into this repository, the Wiki, issue comments, workflow logs, or the terminal
transcript. The following PowerShell pattern copies and verifies them without
printing their values:

```powershell
$firebaseVariableNames = @(
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_FIREBASE_VAPID_KEY'
)

foreach ($firebaseVariableName in $firebaseVariableNames) {
  $stagingFirebaseValue = gh variable get $firebaseVariableName `
    --env staging `
    --repo newtc22222/ff-restaurent
  if ([string]::IsNullOrWhiteSpace($stagingFirebaseValue)) {
    throw "Missing staging variable: $firebaseVariableName"
  }
  gh variable set $firebaseVariableName `
    --env production `
    --repo newtc22222/ff-restaurent `
    --body $stagingFirebaseValue
  $productionFirebaseValue = gh variable get $firebaseVariableName `
    --env production `
    --repo newtc22222/ff-restaurent
  if ($productionFirebaseValue -cne $stagingFirebaseValue) {
    throw "Production variable does not match staging: $firebaseVariableName"
  }
  Write-Host "$firebaseVariableName matches staging"
  Remove-Variable stagingFirebaseValue, productionFirebaseValue
}
```

List names without values afterward:

```powershell
gh api repos/newtc22222/ff-restaurent/environments/production/variables `
  --jq '.variables[].name'
```

The merged deployment workflow supplies API
`FIREBASE_PROJECT_ID=ff-restaurent` as a literal and Firebase Admin authenticates
through Cloud Run Application Default Credentials. Do not create an API
Firebase secret. The workflow's legacy migration step safely removes an old
secret-backed variable before deploying the literal when necessary.

Staging push tokens must not be copied to production. FCM registrations belong
to a browser origin, service worker, user, and environment database. Each user
must enable notifications in the production app so the production API stores
its own subscription.

## Verify the release candidate

Use a disposable local PostgreSQL 16 database. Never run integration tests,
migration rehearsals, or destructive test setup against staging or production.
Set `DATABASE_URL`, `JWT_SECRET`, `REGISTRATION_INVITE_CODE`, `CORS_ORIGINS`,
and `RUN_INTEGRATION_TESTS=1` as CI does, then run the same gates in this order:

```powershell
npm ci
npm run agents:verify
npm run prettier:check
npm run lint
npm run prisma:generate -w @ff-restaurent/api
npm run openapi:check
npm run typecheck
bash scripts/verify-phase2-contract-migration.sh
npm run prisma:migrate:deploy -w @ff-restaurent/api
bash scripts/capture-production-baseline.test.sh
bash scripts/rehearse-gcp-migration.test.sh
bash scripts/rehearse-gcp-migration.integration.test.sh
npm run prisma:phase2:contract:verify -w @ff-restaurent/api
npm run prisma:indexes:verify -w @ff-restaurent/api
bash scripts/run-release-job.test.sh
bash scripts/verify-cloud-run-containers.sh
npm test
npm run build
npm run test:e2e
git diff --check
```

Set `RUN_BASELINE_DB_TESTS=1` for the baseline test and `RUN_FF58_DB_TESTS=1`
for the two-pass PostgreSQL rehearsal, matching `.github/workflows/ci.yml`.
Delete only the explicitly named disposable test database after verification.

Open a release-preparation pull request into `develop`. Require the complete
GitHub CI job, inspect all conversation and review threads, resolve actionable
feedback, and merge only when clean. Then refresh `develop`, confirm the
version and release documents are present, and open a reviewed
`develop` to `main` pull request titled `Release 2.2.0`.

Before merging the release PR, run the production restore drill from current
`main` and require success:

```powershell
gh workflow run 'Backup restore drill' `
  --repo newtc22222/ff-restaurent `
  --ref main `
  -f operation=restore-drill
```

Record the workflow URL and result in the release PR. Also record the current
production API and web revisions for rollback. Do not merge while the restore
drill, release PR CI, review threads, or Firebase production-variable gate is
incomplete.

## Promote and verify production

Merge the reviewed `develop` to `main` release PR. Do not push directly to
`main`. Monitor both the `CI` and `GCP deploy` workflows for the exact merge
SHA.

The deploy must complete these gates:

1. Build verification succeeds.
2. The production release job applies all 22 migrations and runs the cuisine
   seed, phone normalization, and ROOT_ADMIN bootstrap successfully.
3. The API image deploys to `ff-restaurent-api` and the web image deploys to
   `ff-restaurent-web`.
4. API health and readiness checks pass.
5. The production web service responds from its current Cloud Run and custom
   domain URLs.

After the workflow succeeds:

- Confirm the deployed image digests and release execution belong to the
  release merge SHA.
- Confirm the production API environment contains `FIREBASE_PROJECT_ID` as a
  literal whose value is `ff-restaurent`, not a secret reference.
- Confirm the production web image was built with all five non-empty Firebase
  variables without printing them.
- Confirm there are 22 completed migrations and the Drinks cuisine seed is
  present once.
- Sign in on the production origin and enable notifications, then verify the
  production API registers the new token.
- Trigger an eligible payment reminder or product event and verify push
  delivery. Push failure must not fail the authoritative application action.
- Click the push while an FF RESTaurent tab exists and verify that tab navigates
  or reloads and focuses instead of opening another tab.
- Create a notification for a signed-in recipient and verify the header inbox
  and unread badge update within five seconds without a manual reload.
- Disconnect and reconnect the browser network and verify the authoritative
  notification list catches up without duplicates or a user-facing stream
  error.
- Select each accent, reload, and verify the device-local choice persists.

Run the production Phase 2 contract verification and a new post-deploy restore
drill from the release `main` SHA:

```powershell
gh workflow run 'Phase 2 contract verification' `
  --repo newtc22222/ff-restaurent `
  --ref main

gh workflow run 'Backup restore drill' `
  --repo newtc22222/ff-restaurent `
  --ref main `
  -f operation=restore-drill
```

Require both workflows to finish successfully and retain their run URLs and
artifacts as release evidence.

## Rollback and stop conditions

Do not create the tag or GitHub release if CI, the release job, deployment,
contract verification, recovery drill, health/readiness, authentication,
authoritative notification actions, or core production smoke fails.

If the new API or web revision is unhealthy, direct 100% traffic back to the
recorded prior revision for that service:

```powershell
gcloud run services update-traffic <service-name> `
  --project ff-restaurent `
  --region asia-east1 `
  --to-revisions <recorded-prior-revision>=100
```

Roll back the API and web independently when appropriate. Preserve logs,
release execution, image digests, failed checks, and revision names. Do not
delete successful additive migrations or manually edit `_prisma_migrations`.
The three v2.2.0 migrations are additive; an older revision must tolerate the
additional schema while the defect is fixed forward. Escalate before any data
rollback or destructive database action.

The existing in-app `Notification` rows and `GET /notifications` response stay
authoritative. Push and SSE failures must remain silent and must not block
payment reminders, notification creation, navigation, or authentication.

## Tag and publish only after all gates pass

After production verification, contract verification, and the post-deploy
restore drill are green, resolve the exact `main` release merge SHA and create
an annotated tag on that commit:

```powershell
git fetch origin --tags --prune
$releaseSha = gh pr view <release-pr-number> `
  --repo newtc22222/ff-restaurent `
  --json mergeCommit `
  --jq '.mergeCommit.oid'
$currentMainSha = git rev-parse origin/main
if ($currentMainSha -cne $releaseSha) {
  throw 'origin/main advanced after the release merge; verify the boundary before tagging'
}
git tag -a v2.2.0 $releaseSha -m 'FF RESTaurent v2.2.0'
git push origin v2.2.0
gh release create v2.2.0 `
  --repo newtc22222/ff-restaurent `
  --title 'FF RESTaurent 2.2.0' `
  --notes-file <reviewed-release-notes-file>
```

Verify the tag points to the production merge SHA, the GitHub release is
published from that tag, and the Wiki release page contains the final workflow
evidence. Update Linear release bookkeeping only after the production boundary
is verified; do not start or implement FF-46 as part of this release.

## Linear state for the next agent

FF-46, `Redesign the web UI/UX across core member journeys`, was moved to
`Phase 3 — Advanced Automation` on 2026-08-02. It remains Backlog, Medium,
Feature, unassigned, with no cycle, estimate, or dates. Its description,
dependencies, and related issues were preserved.

The Phase 2D milestone now covers product-event notifications, push delivery,
real-time in-app notification updates, and focused theme and interaction
improvements. The Phase 3 milestone states that FF-46 is deferred there and
will follow a separate plan. Re-fetch Linear before changing either milestone.

## Final Production Release Execution Summary (2026-08-02)

FF RESTaurent `v2.2.0` has been fully prepared, reviewed, promoted, deployed, verified, tagged, and published to production.

- **Release Version**: `2.2.0`
- **Release Tag**: `v2.2.0` (pointing to `origin/main` commit `3037c2c8a3481914e9e2a6ee1e8484f3d2e10902`)
- **GitHub Release**: Published at [v2.2.0](https://github.com/newtc22222/ff-restaurent/releases/tag/v2.2.0)
- **Wiki Release Notes**: Created at [Release-v2.2.0](Release-v2.2.0) and linked in `_Sidebar.md`
- **Linear Bookkeeping**: Issue `FF-88` marked as `Done`. `FF-46` preserved in `Phase 3 — Advanced Automation` backlog.
- **Firebase Environment**: All 5 web environment variables copied to GitHub `production` environment.
- **Production Rollback Boundary**:
  - API prior revision: `ff-restaurent-api-00014-pvt`
  - Web prior revision: `ff-restaurent-web-00004-8mf`
- **Deployed Production Services**:
  - API service: `ff-restaurent-api-00015-xx2` ([https://ff-restaurent-api-sglcycpgla-de.a.run.app](https://ff-restaurent-api-sglcycpgla-de.a.run.app))
  - Web service: `ff-restaurent-web-00005-l76` ([https://ff-restaurent-web-sglcycpgla-de.a.run.app](https://ff-restaurent-web-sglcycpgla-de.a.run.app))
- **Production Verification Evidence**:
  - Health & Readiness endpoints (`/health` & `/ready`): Returning 200 OK (`{"ok":true,"database":"ready"}`)
  - GCP Deploy workflow: Passed (run `30755107802`)
  - Post-deployment Phase 2 Contract Verification: Passed (run `30756080811`)
  - Post-deployment Backup Restore Drill: Passed (run `30755342719`)

