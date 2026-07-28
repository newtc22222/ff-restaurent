# AGENTS.md

This file gives coding agents the current repository-specific guidance for FF
RESTaurent.

## Current project stage

Phase 2 is complete and FF RESTaurent `v1.1.0` is published. Read
`.agents/PHASE_2_HANDOFF.md` and `wiki/RELEASE_1-1-0` before release,
production, migration, or roadmap work. They record the shipped schema
contracts, production verification and recovery evidence, and the branch
boundary for later development.

The active milestone is **Phase 2.5 - GCP Migration & Architecture
Foundations**. Before starting new work, refresh Git and Linear, select the next
unblocked Phase 2.5 issue, and branch from the latest `origin/develop`. Do not
reopen Phase 2 or restore its removed legacy restaurant/favorites storage unless
a production regression is demonstrated. Phase 3 begins only after the Phase
2.5 foundation milestone is complete.

Before release, production, migration, or recovery work, read these records:

- `wiki/RELEASE_1-1-0` - authoritative v1.1.0 scope and evidence.
- `.agents/PHASE_2_HANDOFF.md` - Phase 2 implementation and contract-migration
  history. Treat unfinished checklist language there as historical when it
  conflicts with the final release record.
- `.agents/PHASE_1_HANDOFF.md` - Phase 1 history only.

Do not infer the next phase or ticket from an old handoff. Re-fetch Git and
Linear, update a stale handoff when requested, and branch from the latest
`origin/develop` unless the user explicitly defines another release boundary.

## Agent skills system

`.agents/` is the permanent, canonical, version-controlled home for all
project agent skills, instructions, prompts, workflows, configurations,
templates, metadata, and supporting assets. Create and maintain all such
assets only under `.agents/`; do not create new project assets under `.codex/`.
Run `npm run agents:verify` after changing agent-system assets. Because
`.agents/` is tracked, every branch and Git worktree receives the same
canonical system from its checked-out commit.

The repository may contain user-owned uncommitted work. Preserve it. For broad
or release work, use an isolated worktree rather than cleaning the user's
checkout.

## Project overview

FF RESTaurent is an npm-workspaces monorepo for shared restaurant discovery,
group bill splitting, payment tracking, and team administration:

- `apps/api` - Fastify REST API, JWT auth, Zod, Prisma/PostgreSQL, Swagger, and
  Google Cloud Storage-backed media.
- `apps/web` - React 19, React Router, Vite, Tailwind CSS, Vitest, and
  `react-hot-toast`.
- `packages/shared` - shared enums, API/domain types, Vietnamese phone parsing,
  and integer-cent bill-splitting logic.

All packages are versioned `1.1.0`. The shipped database contains 17 Prisma
migrations; the Phase 2 normalized-restaurant contract migration is
`20260720000000_contract_phase2_normalized_restaurants`.

## Common commands

Run commands from the repository root.

```bash
npm install
npm run prettier:check
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

`npm run typecheck` is `tsc -b` and `npm run build` compiles
`@ff-restaurent/shared` first, so neither needs a manual shared pre-build after
a clean `npm ci`. `npm run prettier:check` is the non-mutating counterpart to
`npm run format` and is what CI enforces; the husky/lint-staged hook only covers
staged files.

Useful focused commands:

```bash
npm test -w @ff-restaurent/shared
npm test -w @ff-restaurent/api
npm test -w @ff-restaurent/web
npm run prisma:generate -w @ff-restaurent/api
npm run prisma:migrate:deploy -w @ff-restaurent/api
npm run prisma:indexes:verify -w @ff-restaurent/api
npm run prisma:phase2:contract:verify -w @ff-restaurent/api
```

Prisma loads `apps/api/prisma.config.ts`, so API typecheck/build/Prisma commands
require `DATABASE_URL`, even when they do not query the database. State clearly
when database or Docker verification was skipped; do not describe the remaining
suites as full verification.

For local full-stack development:

```bash
docker compose up --build
```

- Web: `http://localhost:5173`
- API: `http://localhost:4000`
- Health: `http://localhost:4000/health`
- Readiness: `http://localhost:4000/ready`
- Swagger: `http://localhost:4000/api/docs`

## Architecture

### API

`apps/api/src/app.ts` is composition-only. Domain routes are split under
`apps/api/src/routes/`; do not put all endpoints back into `app.ts`.

`apps/api/src/` is grouped by layer. Add new code to the matching directory
rather than the source root, which holds only `app.ts` and `server.ts`.

- Validation and request transforms: `apps/api/src/schemas/` (import via the
  `schemas/index.ts` barrel, not individual domain files)
- Auth guards: `apps/api/src/http/auth-guards.ts`
- Error mapping: `apps/api/src/http/error-handler.ts`
- Role helpers and public user selection: `apps/api/src/lib/roles.ts`
- Pure utilities and the Prisma client: `apps/api/src/lib/`
- Environment and server configuration: `apps/api/src/config/`
- Domain services: `apps/api/src/services/` (e.g. `bill-service.ts`,
  `collection-service.ts`, `root-admin-service.ts`)
- Restaurant compatibility serialization: `apps/api/src/contracts/restaurant-contract.ts`
- Prisma schema and migrations: `apps/api/prisma/`

Use Prisma for persistence and Zod for request validation. When an API field or
relation changes, update the Prisma migration, query select/include shape,
serializer, web API types, and focused tests together.

### Web

The web application is route-based. Do not follow the obsolete single
`App.tsx`/`tab`/`screen` architecture.

- Router loaders/actions and route definitions: `apps/web/src/app/router.ts`
- App shell and route error boundary: `apps/web/src/app/App.tsx`
- Providers: `apps/web/src/app/providers/`
- Pages: `apps/web/src/pages/`
- Feature slices (own their pages, components, loaders and actions):
  `apps/web/src/features/` — `bills/` and `restaurants/`
- Shared route helpers: `apps/web/src/app/route-helpers.ts`
- API client/types: `apps/web/src/lib/api.ts`
- Session/token handling: `apps/web/src/lib/session.ts`
- Role helpers: `apps/web/src/lib/helpers.ts`
- Localized result mapping: `apps/web/src/lib/result-messages.ts`
- Translations: `apps/web/src/lib/translations/` — JSON per locale and domain
  (`{vi,en}/<domain>.json`) behind a typed barrel; add keys to Vietnamese first,
  which is the source of truth for the key set

Use the existing router loader/action patterns and `useMutation`. Mutation
results, API failures, and background warnings use localized
`react-hot-toast`; keep field validation inline, confirmations modal, and fatal
route failures in the route error boundary. Avoid reintroducing page-level
transient result banners.

Use `apps/web/src/components/ui/Dropdown.tsx` for production selection controls;
do not add native `<select>` elements. Use the app-owned `ScrollArea` CSS
overflow wrapper where scrolling is needed; do not add
`react-scrollbars-custom`.

### Shared domain rules

All persisted and API monetary values are integer cents. Core allocation logic
is in `packages/shared/src/bill-splitting.ts`; never duplicate it in the API or
web application.

`apps/api` and `apps/web` consume `@ff-restaurent/shared` through TypeScript
project references, so `npm run typecheck` (`tsc -b`) rebuilds
`packages/shared/dist/` before checking the apps — no manual pre-build is
needed. The one asymmetry to know about: web's `vite.config.ts` still aliases
the package to its **source**, so the Vite dev server and Vitest pick up shared
edits immediately, while `tsc` validates against the regenerated declarations.

Vietnamese phone parsing is in `packages/shared/src/phone.ts`. The API is the
authoritative validator and stores valid optional phones in E.164 form.

## Authorization model

Effective permissions ascend as:

`CUSTOMER < SOUS_CHEF < HEAD_CHEF < ROOT_ADMIN`

- `CUSTOMER` is represented by `chefRole: null`.
- `SOUS_CHEF` can create restaurants and bills and manage owned work.
- `HEAD_CHEF` adds global bill visibility and archive/restore capabilities.
- `ROOT_ADMIN` is the singleton `systemRole`, inherits Head Chef capabilities,
  and exclusively manages member roles, root transfer, password-recovery
  administration, and other system controls.

`chefRole` and `systemRole` are independent. HEAD_CHEF must never change member
roles or ROOT_ADMIN ownership. Keep API checks in `apps/api/src/lib/roles.ts` and web
checks in `apps/web/src/lib/helpers.ts` behaviorally aligned.

JWTs carry `sessionVersion`. Password changes, assisted resets, and root
transfers invalidate affected sessions. Never serialize password or reset-code
hashes.

## Phase 2 data contracts that remain authoritative

- Collections are the sole persistence authority for Favorites and Recommended
  restaurants. Do not restore `UserFavorite` or legacy restaurant favorite /
  recommendation columns.
- `RestaurantCuisine` is the cuisine authority and every restaurant has exactly
  one primary Cuisine. Legacy response aliases such as `cuisineType` are derived
  by the compatibility serializer.
- Restaurant platform links are normalized rows, not legacy JSON.
- Directory endpoints use deterministic cursor pagination with `{ items,
pageInfo }`; default page size is 25 and maximum is 100.
- Authenticated API traffic is network-only in PWA caching rules.
- Media and payment QR files use Google Cloud Storage through Application
  Default Credentials. Public images live in a public-read bucket; payment QR
  images stay private and are exposed only through short-lived signed URLs.

## Environment and deployment

Start from `.env.example`. Important variables include:

- `DATABASE_URL`
- `JWT_SECRET`, `JWT_EXPIRES_IN`
- `REGISTRATION_INVITE_CODE`
- `ROOT_ADMIN_USERNAME`
- `CORS_ORIGINS`
- `GCP_PROJECT_ID`, `GCS_PUBLIC_BUCKET`, `GCS_QR_BUCKET`
- `GCS_SIGNED_URL_TTL_SECONDS`
- `API_PORT`, `VITE_API_URL`

Production API startup order is fixed:

1. `prisma migrate deploy`
2. phone normalization/backfill
3. singleton ROOT_ADMIN bootstrap
4. `exec node dist/server.js`

Keep Node as PID 1. Production root bootstrap fails closed when no root exists
and `ROOT_ADMIN_USERNAME` does not identify an existing user. Use the interactive
operator recovery command only for emergency root-account recovery.

Release verification uses `.github/workflows/ci.yml`,
`phase2-production-data.yml`, `staging-smoke.yml`, and
`backup-restore-drill.yml`. Recovery evidence must compare counts captured from
the same database snapshot as the dump.

## Agent guidelines

- Prefer focused changes and one Linear ticket per feature branch unless the
  user explicitly approves a broader release branch.
- Verify current Git, GitHub, and Linear state before selecting release or
  roadmap work; old plans and handoffs can be stale.
- Preserve unrelated dirty-worktree changes and do not use destructive Git
  cleanup commands.
- Keep normalized Phase 2 contracts intact while implementing later phases.
- Add indexes from measured final queries, not speculation.
- Run focused tests first, then the applicable lint, typecheck, test, build,
  migration, and Playwright gates in proportion to risk.
- For frontend design or UX changes, also use the repository's
  `ff-restaurent-ux` skill.
