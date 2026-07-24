# FF-58 Handoff — Snapshot-Consistent Render-to-Cloud SQL Rehearsal

Last updated: 2026-07-24 (Asia/Saigon)

## Repository and ticket state

- Ticket: **FF-58 — Snapshot-Consistent Render-to-Cloud SQL Rehearsal**
- Linear status: **In Progress**
- Worktree:
  `C:\Vault\Project\management-platform\ff-restaurent-ff-58`
- Branch: `feature/ff-58-rehearse-render-cloud-sql-migration`
- Base and current HEAD:
  `2034a652cfa2707e11b88321e508cc5e05ed9801`
- Upstream base: `origin/develop` at the same SHA when implementation began
- Git publication state: changes are unstaged and uncommitted; nothing has
  been pushed and no FF-58 PR exists
- The original checkout at
  `C:\Vault\Project\management-platform\ff-restaurent` is dirty and
  user-owned. Do not clean, reset, overwrite, or incorporate it.

## 1. Original task and acceptance criteria

Implement only FF-58. Rehearse a snapshot-consistent migration from the
surviving Render PostgreSQL production database into a fixed disposable Cloud
SQL database without modifying Render, the permanent `ff_restaurent` database,
the permanent FF-56 Cloud Run placeholders, or Phase 2 application contracts.

The requested operator flow was:

1. Add a command with `--plan`, `--apply`, and explicit `--cleanup`.
2. Validate the fixed GCP project/account, Render database, PostgreSQL 16 tool
   versions, secure artifact/passphrase permissions, and absence of conflicting
   temporary resources.
3. Reuse the existing exported repeatable-read FF-55 capture implementation.
   Do not rewrite the scheduled restore drill.
4. Store encrypted captures and sanitized evidence under
   `/home/f1fine/.local/state/ff-restaurent/ff-58`. Keep plaintext only in a
   mode-`700` temporary directory removed by a trap.
5. Use the fixed disposable database `ff_release_verify`. For each of two
   passes:
   - decrypt and validate the artifact, internal checksums, PostgreSQL 16,
     exactly 17 completed migrations, zero rollbacks, and the named Phase 2
     contract migration;
   - restore with `--no-owner`, `--no-acl`, `--exit-on-error`, and one
     transaction;
   - require restored row counts to match counts captured from the exact dump
     snapshot;
   - execute and await the immutable FF-57 Cloud Run release job;
   - require zero row-count drift after release work;
   - verify migration, index, ROOT_ADMIN, Cuisine, Collections, phone,
     monetary, foreign-key, and orphan invariants.
6. Delete and recreate the database between passes and require stable
   machine-readable invariant output.
7. Recreate the fixed disposable FF-57 verification job/services using the
   existing immutable API/web image digests.
8. Extend smoke testing with separate optional API/web Cloud Run identity
   tokens sent through `X-Serverless-Authorization`, while leaving application
   JWT `Authorization` unchanged.
9. Record capture, restore/release/verification, reset, deployment, and smoke
   durations. Calculate projected cutover as capture plus the slower pass plus
   deploy/smoke, and fail above 900 seconds.
10. Always remove the temporary database, secrets, IAM bindings, job, services,
    impersonation access, proxy, and credentials. Confirm the permanent
    placeholders and main-only WIF trust are unchanged.
11. Add focused mocked failure tests and a PostgreSQL 16 two-pass integration
    test. Run ShellCheck, actionlint, lint, typecheck, tests, builds, Prisma
    generation/validation/deployment, Phase 2 contract verification, index
    verification, and the live migration rehearsal.
12. Report the exact diff and evidence, then stop before commit/push/PR for
    operator approval.

Completion after approval requires committing, pushing, opening the FF-58 PR,
attaching sanitized evidence to the PR and Linear, merging, recording merge
evidence, marking FF-58 Done, and re-evaluating FF-59. Any count drift,
invariant failure, cleanup failure, or projected duration above 15 minutes
blocks FF-59.

## 2. Current implementation status

Implementation and the live rehearsal are complete. The final successful
rehearsal:

- captured a fresh read-only Render snapshot once;
- restored that exact encrypted artifact twice;
- matched source-snapshot counts before release work on both passes;
- had zero post-release row-count drift;
- ran two successful immutable Cloud Run release executions;
- produced identical normalized invariant results;
- deployed and smoked the private disposable API/web services;
- calculated a 216-second projected cutover against the 900-second budget;
- removed all disposable GCP resources and temporary IAM access;
- verified the permanent database, permanent placeholder revisions, and
  durable main-only WIF trust were unchanged.

No production cutover, source-write freeze, Render mutation, permanent
application deployment, DNS/CORS production change, schema change, Phase 3
work, commit, push, or PR creation occurred.

The final successful local evidence is:

- Encrypted artifact:
  `/home/f1fine/.local/state/ff-restaurent/ff-58/ff-restaurent-production-baseline-20260723T181438Z.tar.gz.gpg`
- Artifact SHA-256:
  `717329df6635b96afdb0d090175d2fb25cc7a3b64e04cb1b98a177e3d4b11918`
- Sanitized evidence:
  `/home/f1fine/.local/state/ff-restaurent/ff-58/ff-58-rehearsal-evidence.json`
- Evidence SHA-256:
  `59ae8628ab1add46663e26a91408e13f4438ada61b5fbcc67413e7ac7f10870c`
- Source Render deployed SHA:
  `0638ae3aa622b30ed024302106802d32458d3d32`
- Release executions:
  - `ff-restaurent-release-verify-nvhjv`
  - `ff-restaurent-release-verify-qsrnh`
- Timings:
  - capture: 17 seconds
  - pass 1: 59 seconds
  - database reset: 6 seconds
  - pass 2: 58 seconds
  - deploy and smoke: 140 seconds
  - projected cutover: 216 seconds

The final verifier reported:

- 17 expected and completed migrations;
- zero rollbacks;
- Phase 2 contract migration exactly once;
- exactly one ROOT_ADMIN;
- zero Cuisine, Favorites, legacy-storage, foreign-key, orphan, monetary,
  allocation, phone-validity, collision, or normalization violations;
- exactly one Recommended collection;
- 30 validated foreign keys;
- four required index definitions;
- seven non-null canonical phones;
- overall `passed: true`;
- smoke `passed: true`;
- cleanup `passed: true`.

The independent FF-55 fallback artifact remains intact and its checksum was
reverified.

## 3. Files changed and what changed

Implementation changes:

- `.github/workflows/ci.yml`
  - Adds the focused FF-58 failure suite.
  - Adds the PostgreSQL 16 two-pass rehearsal integration test.
- `apps/api/package.json`
  - Adds `prisma:migration:verify`.
- `apps/api/prisma/verify-migration-rehearsal.ts`
  - New sanitized machine-readable semantic verifier.
  - Validates exact repository migration inventory, zero rollbacks, the named
    contract migration, ROOT_ADMIN, Phase 2 Collections/Cuisine authority,
    absence of legacy storage, every foreign-key constraint and orphan count,
    required index definitions, integer monetary columns, participant
    reconciliation, and canonical Vietnamese phones.
- `docs/03_PRODUCTION_RUNBOOK.md`
  - Documents FF-58 plan/apply/cleanup usage, fixed disposable resources,
    evidence location, cleanup boundary, abort conditions, and 900-second
    budget.
- `scripts/staging-smoke.mjs`
  - Adds optional `API_CLOUD_RUN_IDENTITY_TOKEN` and
    `WEB_CLOUD_RUN_IDENTITY_TOKEN`.
  - Sends Cloud Run identity through `X-Serverless-Authorization`.
  - Preserves application JWTs in `Authorization`.
- `scripts/staging-smoke.test.mjs`
  - Verifies separate API/web identity tokens and application JWT coexistence.
- `scripts/rehearse-gcp-migration.sh`
  - New idempotent FF-58 operator command with `--plan`, `--apply`, and
    `--cleanup`.
  - Reuses temporary LF-normalized copies of the existing FF-55 capture scripts
    because the Windows checkout materializes those older Bash files with CRLF.
  - Bridges WSL PostgreSQL/Render/Proxy tooling to Windows gcloud and Node/npm
    without printing secrets.
  - Implements capture, two restore/release/invariant passes, private
    deployment/smoke, duration enforcement, evidence generation, cleanup, and
    permanent-boundary assertions.
- `scripts/rehearse-gcp-migration.test.sh`
  - Tests wrong account/project, disabled billing, permissive secret
    permissions, partial resources, checksum/decryption/manifest failures,
    restore/count/release/invariant failures, impersonation timeout, private
    smoke failure, token redaction, cleanup targeting, and preservation of the
    operator-owned Docker configuration.
- `scripts/rehearse-gcp-migration.integration.test.sh`
  - Creates isolated PostgreSQL 16 source/target databases.
  - Migrates and seeds a minimal valid fixture.
  - Captures and encrypts one snapshot, restores it twice, runs the release
    command twice, checks count stability, recreates the target database, and
    compares invariant JSON.
- `HANDOFF.md`
  - This handoff only; no application code was changed while creating it.

Before adding this handoff, the tracked implementation diff contained 154
additions and six deletions plus four new implementation files. Review the live
diff rather than relying on those counts after this file is included.

## 4. Important architectural decisions

1. **Snapshot authority**
   - Source counts must come from the same exported repeatable-read snapshot as
     `pg_dump`. Pre-dump live counts are not accepted.
2. **Reuse rather than rewrite**
   - FF-58 invokes the already-correct FF-55 capture primitive. The scheduled
     restore drill remains behaviorally unchanged.
3. **Immutable release inputs**
   - API image:
     `asia-east1-docker.pkg.dev/ff-restaurent/ff-restaurent/api@sha256:61a911a332092fcf6d038ac68af5275978346da5e9e0091db08c4e33697ddbeb`
   - Web image:
     `asia-east1-docker.pkg.dev/ff-restaurent/ff-restaurent/web@sha256:3b8941e878a7a784fb502f0d55bc02998d5a47b8859661b9f2bcae0039fece8d`
   - FF-58 does not rebuild or push images.
4. **Fixed disposable boundary**
   - Database: `ff_release_verify`
   - Secrets: `ff-release-verify-database-url`,
     `ff-release-verify-cors-origins`
   - Job: `ff-restaurent-release-verify`
   - Services: `ff-restaurent-api-verify`,
     `ff-restaurent-web-verify`
   - Cleanup functions refuse or avoid permanent names.
5. **Deterministic index verification**
   - The first live attempt stopped because the legacy plan-based index checker
     required PostgreSQL to select one specific valid index. With real
     production statistics, PostgreSQL selected another installed valid index.
   - FF-58 now deterministically verifies the four required index definitions
     in the semantic verifier. The legacy checker remains unchanged and still
     passes its normal repository/CI validation.
6. **Separate Cloud Run and application authentication**
   - Cloud Run identity uses `X-Serverless-Authorization`.
   - Application JWT continues to use `Authorization`.
7. **No secret-bearing process arguments or logs**
   - Passwords, database URLs, passphrases, access tokens, identity tokens, and
     record contents are never printed.
   - Tokens/passwords are passed through environment variables or stdin.
8. **Cleanup precedes canonical evidence**
   - The final evidence file is written only after cleanup and permanent-state
     verification pass.
9. **Phase 2 contracts remain authoritative**
   - Collections are the only Favorites/Recommended authority.
   - `RestaurantCuisine` is the only cuisine authority.
   - Legacy restaurant fields and `UserFavorite` must not return.
   - No schema or API contract change is part of FF-58.

## 5. Commands already run and results

Representative commands:

```bash
bash scripts/rehearse-gcp-migration.sh --plan
bash scripts/rehearse-gcp-migration.sh --apply
bash scripts/rehearse-gcp-migration.test.sh
RUN_FF58_DB_TESTS=1 \
  DATABASE_URL='postgresql://ff:ff@127.0.0.1:<ephemeral>/postgres?schema=public' \
  bash scripts/rehearse-gcp-migration.integration.test.sh
shellcheck scripts/rehearse-gcp-migration.sh \
  scripts/rehearse-gcp-migration.test.sh \
  scripts/rehearse-gcp-migration.integration.test.sh
actionlint .github/workflows/ci.yml .github/workflows/gcp-deploy.yml
```

```powershell
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npx prisma validate --schema apps/api/prisma/schema.prisma
npm run prisma:generate -w @ff-restaurent/api
npm run prisma:migrate:deploy -w @ff-restaurent/api
npm run prisma:phase2:contract:verify -w @ff-restaurent/api
npm run prisma:indexes:verify -w @ff-restaurent/api
$env:RUN_INTEGRATION_TESTS='1'; npm test -w @ff-restaurent/api
npm run test:e2e
npx prettier --check <changed formatted files>
git diff --check
```

Results:

- Final `--plan`: passed; no conflicting disposable resources; permanent
  boundaries and main-only WIF trust intact.
- Final live `--apply`: passed.
- Encrypted artifact and evidence checksum reproduction: passed.
- FF-55 fallback checksum reproduction: passed.
- Prisma migration deployment: 17/17 applied.
- Phase 2 contract verifier: passed.
- Legacy query-shape index verifier: passed in the normal PostgreSQL test
  environment.
- Final deterministic FF-58 index-definition verification: passed against the
  restored production dataset.
- No ephemeral PostgreSQL containers remain.
- `npm ci` completed but reported two existing dependency advisories: one
  moderate and one high. No dependency changes were made under FF-58.

## 6. Tests that pass or fail

Passing final checks:

- FF-58 focused failure/redaction/cleanup suite: passed.
- PostgreSQL 16 two-pass capture/restore/release/invariant suite: passed.
- ShellCheck: passed.
- actionlint: passed.
- Prettier check: passed.
- `git diff --check`: passed.
- Workspace lint: passed.
- Workspace typecheck: passed.
- Prisma generation and schema validation: passed.
- Workspace unit tests:
  - API: 42 passed and 16 database tests initially skipped;
  - Web: 75 passed;
  - Shared: 13 passed;
  - root script tests: 6 passed.
- API rerun with PostgreSQL integration enabled: 58/58 passed, zero skipped.
- Playwright: 7/7 passed.
- Workspace production builds: passed.
- Live two-pass rehearsal and authenticated private smoke: passed.

Historical stopped check:

- The first live rehearsal attempt stopped during pass 1 because
  `verify-final-query-indexes.ts` expected
  `Notification_billId_userId_createdAt_idx`, while PostgreSQL selected the
  installed `Notification_userId_createdAt_id_idx` for the synthetic reminder
  query based on real statistics.
- There was no missing index, count drift, data invariant failure, or release
  failure.
- The cleanup trap removed all disposable resources, and a subsequent
  read-only plan independently confirmed cleanup and permanent-state integrity.
- The issue was corrected with deterministic index-definition verification,
  the PostgreSQL fixture was rerun, and the complete live rehearsal then passed.

## 7. Known issues and blockers

- **Approval blocker:** the operator has not yet approved committing and
  publishing the reported FF-58 diff. Do not stage, commit, push, create a PR,
  or update FF-58 to Done without that approval.
- **Dependency advisories:** `npm ci` reports one moderate and one high
  advisory in the existing lockfile. Remediation is outside FF-58.
- **Aborted encrypted capture retained:** the first stopped attempt left
  `/home/f1fine/.local/state/ff-restaurent/ff-58/ff-restaurent-production-baseline-20260723T180902Z.tar.gz.gpg`.
  It is encrypted diagnostic evidence, not the final successful artifact.
  Do not treat it as canonical and do not delete it without operator direction.
- **No ongoing FF-58 infrastructure:** all temporary live resources were
  removed. FF-58 has no recurring resource configuration after cleanup, though
  the completed Cloud Run/Cloud SQL operations may incur one-time usage.
- **Linear remains In Progress:** FF-58 must stay In Progress until PR merge
  evidence is recorded.

There is no implementation or live-rehearsal blocker.

## 8. Exact next steps

1. Wait for explicit operator approval to commit and publish.
2. Before publication, confirm:

   ```powershell
   Set-Location C:\Vault\Project\management-platform\ff-restaurent-ff-58
   git status --short --branch
   git diff --check
   git diff --cached --quiet
   ```

3. Review the complete unstaged diff, including this `HANDOFF.md`. Preserve the
   exact FF-58 scope and do not include files from the dirty original checkout.
4. After approval, stage only:

   ```text
   .github/workflows/ci.yml
   HANDOFF.md
   apps/api/package.json
   apps/api/prisma/verify-migration-rehearsal.ts
   docs/03_PRODUCTION_RUNBOOK.md
   scripts/rehearse-gcp-migration.integration.test.sh
   scripts/rehearse-gcp-migration.sh
   scripts/rehearse-gcp-migration.test.sh
   scripts/staging-smoke.mjs
   scripts/staging-smoke.test.mjs
   ```

5. Inspect `git diff --cached` and commit with a focused message such as:

   ```text
   feat(migration): rehearse Render to Cloud SQL migration
   ```

6. Push `feature/ff-58-rehearse-render-cloud-sql-migration`.
7. Open a PR targeting `develop`, link FF-58, and include:
   - the successful artifact digest, but not the passphrase or artifact
     contents;
   - the sanitized evidence JSON/digest;
   - both release execution IDs;
   - 216-second projected cutover;
   - invariant and smoke results;
   - cleanup and permanent-boundary proof;
   - the initial planner false-negative and deterministic correction.
8. Attach the same sanitized evidence summary to FF-58 in Linear. Keep the
   ticket In Progress.
9. Wait for required CI. Investigate any failure before changing scope.
10. After merge, record the PR number, merge SHA, CI result, and live rehearsal
    evidence in Linear; then mark FF-58 Done.
11. Re-fetch Git and Linear and re-evaluate FF-59. Do not begin FF-59 merely
    because this local implementation passed.

## 9. Assumptions and context for the next agent

- Fixed GCP project: `ff-restaurent`
- Project number: `192523226156`
- Region: `asia-east1`
- Expected operator account: `phi.vo.tech@gmail.com`
- Cloud SQL instance: `ff-restaurent-db`
- Permanent database: `ff_restaurent`
- Render production database ID: `dpg-d9aced58nd3s73aqvhu0-a`
- Render API service ID: `srv-d9achtd7vvec738us4pg`
- Runtime identity:
  `ff-runtime@ff-restaurent.iam.gserviceaccount.com`
- Deploy identity:
  `github-deployer@ff-restaurent.iam.gserviceaccount.com`
- Passphrase file:
  `/home/f1fine/.config/ff-restaurent/ff-55-passphrase`
  - parent mode must be `700`;
  - file mode must be `600`;
  - never print, copy into chat, commit, or upload it.
- FF-58 output directory:
  `/home/f1fine/.local/state/ff-restaurent/ff-58`
  - directory mode `700`;
  - artifact/evidence files mode `600`;
  - outside every Git worktree.
- WSL distribution: `Ubuntu-22.04`
- WSL tools include Render CLI, PostgreSQL 16 clients, GPG, Cloud SQL Auth
  Proxy, ShellCheck, and actionlint.
- gcloud and Node/npm are Windows-local; the operator script contains safe
  bridges for them.
- The final successful capture is the `...T181438Z...` artifact. The
  `...T180902Z...` artifact belongs to the stopped false-negative attempt.
- FF-55, FF-56, and FF-57 are complete. FF-58 is the only ticket in scope.
- The latest known roadmap rule is that FF-59 must be re-evaluated only after
  FF-58 merge evidence; do not rely on old dependency documents without
  re-querying Linear.
- Never restore legacy restaurant columns or `UserFavorite`.
- Collections remain the sole Favorites/Recommended authority.
- `RestaurantCuisine` remains the sole cuisine authority.
- Preserve Render startup/recovery behavior and Cloud Run one-shot release-job
  behavior.
- No Phase 3 work is authorized.
