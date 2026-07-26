# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FF RESTaurent is a group bill-splitting and restaurant tracker for a shared team, currently at v1.1.0 (Phase 2 complete). It is a **npm workspaces monorepo** with three packages:

- `apps/api` — Fastify REST API with JWT auth, Swagger docs, and Prisma/PostgreSQL
- `apps/web` — React SPA/PWA (Vite + Tailwind CSS) with EN/VI i18n and light/dark theming
- `packages/shared` — TypeScript types, enums, bill-splitting math, and phone normalization shared across both apps

## Commands

```bash
# Run everything with Docker (recommended for first-time setup)
docker compose up --build

# Install all workspace dependencies
npm install

# Build shared to dist/ — required for `npm run build` and the packaged API.
# (Dev servers and typecheck alias @ff-restaurent/shared to its source, so this
#  is not strictly needed just to start the dev servers.)
npm run build -w @ff-restaurent/shared

# Run dev servers
npm run dev -w @ff-restaurent/api     # http://localhost:4000
npm run dev -w @ff-restaurent/web     # http://localhost:5173

# Database
npm run prisma:migrate -w @ff-restaurent/api   # Run migrations (dev)
npm run prisma:seed -w @ff-restaurent/api      # Seed demo data
npm run prisma:root:bootstrap -w @ff-restaurent/api  # Promote ROOT_ADMIN (uses ROOT_ADMIN_USERNAME)

# Verification (mirrors CI)
npm run typecheck
npm test
npm run build
npm run test:e2e      # Playwright acceptance tests
npm run smoke         # Staging smoke suite (scripts/staging-smoke.mjs)
npm run measure:web    # Web bundle size report (scripts/measure-web-bundle.mjs)

# Run only shared package tests
npm test -w @ff-restaurent/shared

# Lint and format
npm run lint
npm run format
```

API docs (Swagger UI): `http://localhost:4000/api/docs`

Pre-commit hooks (husky + lint-staged) run Prettier on staged `ts/tsx/js/jsx/json/md/css` files — a commit may reformat files rather than fail outright.

## Architecture

### Role System

Two independent role fields on `User`:

- `chefRole` (`null | 'SOUS_CHEF' | 'HEAD_CHEF'`) — the implicit base role is CUSTOMER. Permissions cascade:
  - **CUSTOMER**: view/mark-paid own bill shares, view restaurants, manage own favorites collection
  - **SOUS_CHEF**: + create/edit bills they own, create/edit restaurants, send reminders
  - **HEAD_CHEF**: + archive/restore bills and restaurants, change member roles, view all bills, manage the Recommended collection
- `systemRole` (`null | 'ROOT_ADMIN'`) — exactly one holder (unique constraint). Passes every chef check and additionally handles root-admin transfer (audited) and password-reset approval. Bootstrap/recovery scripts live in `apps/api/prisma/`.

Helpers `isRootAdmin`, `isSousChefOrAbove`, `isHeadChef` live in `apps/api/src/roles.ts`; auth guards in `apps/api/src/http/auth-guards.ts`. Login accepts username or phone; `sessionVersion` on `User` invalidates old JWTs. Registration requires `REGISTRATION_INVITE_CODE`. Password recovery is operator-approved (see `wiki/Password-Recovery-Operations`).

### Bill Splitting

All money values are **integer cents** throughout the stack. The core math is in `packages/shared/src/bill-splitting.ts` (tested in `bill-splitting.test.ts`). `calculateBillSplit` distributes VAT, shipping, discounts, and vouchers across participants; `Bill.adjustmentAllocation` selects `EQUAL` or `PROPORTIONAL` allocation.

The shared package compiles TypeScript to `dist/`. Both apps alias `@ff-restaurent/shared` to the package **source** (`packages/shared/src/index.ts`) — via the API/web tsconfigs and web's `vite.config.ts` — so the dev servers (`tsx watch`, Vite) and `typecheck` resolve source directly with no prior build. The `dist/` output is what the root `npm run build` and the API's esbuild bundle consume (the bundle marks the package `external` and resolves it at runtime), so build shared before those.

### API Structure

`apps/api/src/app.ts` is composition-only: it registers core plugins (CORS, JWT, rate limit in production, Swagger) and then one `register*Routes` function per module from `apps/api/src/routes/` (auth, address, catalog, collection, feedback, password-reset, participant-group, profile, member, media, restaurant, bill, notification, stats). `media` handles Supabase-backed image/QR upload, list, and delete endpoints. Services and helpers sit at `apps/api/src/` top level (`collection-service.ts`, `root-admin-service.ts`, `address-directory.ts`, `restaurant-contract.ts`, …). The `preHandler` chain is: `requireAuth` (populates `request.currentUser`) → optional `requireSousChef` / `requireHeadChef`.

Validation uses **Zod schemas** in `apps/api/src/schemas.ts`. Config comes from `loadConfig()` in `apps/api/src/config.ts`. After changing `apps/api/prisma/schema.prisma`, run `prisma:migrate` to generate a migration and regenerate the client.

Key domain models beyond users/bills: `Cuisine` + `RestaurantCuisine` (every restaurant has exactly one primary cuisine), `DiningArea`, `RestaurantPlatformLink` (typed Grab/ShopeeFood/BeFood/Gojek/… links), `Collection`/`CollectionShare`/`CollectionRestaurant` (per-user FAVORITES and one global RECOMMENDED system collection — favorites and recommendations flow through collections), `Feedback` (one per bill+user, decimal food/service ratings), `PaymentQrImage` (owner-scoped payment QR images stored in Supabase, referenced by `Bill.paymentQrImageId`), `ParticipantGroup`, and audit tables (`BillAuditLog`, `RoleAuditLog`, `RootAdminTransferAudit`). Denormalized `searchText` columns back list search.

### Phase 2 contract (FF-38) — complete

The normalized-restaurant contract shipped in v1.1.0. Migration `20260720000000_contract_phase2_normalized_restaurants` fails closed on the invariants (every restaurant has exactly one primary Cuisine; every user has exactly one FAVORITES collection; exactly one RECOMMENDED collection exists; all legacy favorites/recommendations/platform links have normalized equivalents) and then **drops** `UserFavorite` and the legacy `RestaurantEntry.cuisineType`, `links`, `isFavorite`, and `isRecommended` columns. Collections and normalized `Cuisine`/`RestaurantPlatformLink` relations are now the sole persistence authority — the dual-write phase is over.

**Backward-compat surface still in place (don't break):** the API boundary continues to _serve_ the legacy response aliases (`cuisineType`, `isFavorite`, `isRecommended`, plus `isFavoritedByMe`) derived in `restaurant-contract.ts`, and continues to _accept_ the deprecated `links` write input (translated into `platformLinks`). These are contract guarantees for existing clients, not persisted state.

Verify the contract against a live DB with `npm run prisma:phase2:contract:verify -w @ff-restaurent/api` (`prisma/verify-phase2-contract.ts`); it checks the migration by name so it stays compatible with later migrations layered on top. See `wiki/Phase-2-Migration-Runbook`.

### Web Structure

`apps/web/src/` is organized as:

- `app/` — `App.tsx`, the `react-router` route tree (`router.ts`: `createBrowserRouter` with per-route loaders/actions and lazy-loaded pages), and providers (`app-context`, `i18n`, `theme`)
- `pages/` — one component per non-feature screen (Login, Bills, BillDetail, CreateBill, Collections, CollectionDetail, ParticipantGroups, Stats, Profile, Admin)
- `features/` — domain-owned pages, components, and colocated tests; `restaurants/` contains the restaurant directory and detail feature
- `components/` — shared `ui/` primitives, `layout/`, and `address/`
- `lib/` — `api.ts` (`ApiClient` class, all API calls, local response types), `session.ts`, `translations.ts`, `pwa.ts`
- `hooks/` — e.g. `useMutation`

Routing is `react-router` (v7), configured in `app/router.ts`; screens load data through per-route `loader`s and submit mutations through `action`s (`AppLoaderData` lives in `app-context`). `VITE_API_URL` controls the API base URL. Web tests are colocated `*.test.tsx` files.

### Shared Package Exports

`packages/shared` exports enums (`ChefRole`, `SystemRole`, `EntryStatus`, `PaymentStatus`, `AdjustmentType`, `AdjustmentAllocation`), `ROLE_LABELS` (vi/en), split types (`BillSplitInput`, `BillSplitResult`, `DiscountInput`, `VoucherInput`, …), `calculateBillSplit`, and phone normalization helpers (`phone.ts`).

## Environment Variables

Copy `.env.example` to `.env` before running locally without Docker (change the DB host from `postgres` to `localhost`):

```
DATABASE_URL=postgresql://ff:ff@localhost:5432/ff_restaurent?schema=public
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=8h
CORS_ORIGINS=http://localhost:5173
REGISTRATION_INVITE_CODE=replace-with-a-private-group-invite
ROOT_ADMIN_USERNAME=replace-with-an-existing-username

# Supabase Storage (service-role key is API-only; never expose it to Vite)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=replace-with-supabase-service-role-key
SUPABASE_PUBLIC_BUCKET=ff-public-images
SUPABASE_QR_BUCKET=ff-payment-qr
SUPABASE_SIGNED_URL_TTL_SECONDS=900

API_PORT=4000
VITE_API_URL=http://localhost:4000
```

The address directory uses the validated Vietnam province and ward dataset bundled with the API.

## Operations & Releases

- `wiki/` — numbered operator guides (deployment, production runbook, phone contract, root-admin operations, password sessions/recovery)
- `wiki/` — release evidence and the Phase 2 migration runbook
- `.github/workflows/` — `ci`, `staging-smoke` (also scheduled during observation windows), `backup-restore-drill`, and `phase2-production-data` (manual dry-run/apply dispatch on `main`)

### Practice environment (`env/practice`)

A throwaway-safe environment on Render, backed by **Prisma Postgres** rather than Render's
retiring managed PostgreSQL. It lives on the long-lived `env/practice` branch (branched from
`develop`), where `render.yaml` defines both services — `ff-restaurent-practice-api` (Docker,
the `render` stage of `apps/api/Dockerfile`) and `ff-restaurent-practice-web` (static).

Changes flow one way, `develop` → `env/practice`; never merge the branch back, since its
`render.yaml` is environment-specific. It is independent of the GCP/Cloud Run track — don't
point `scripts/retire-render.sh` at the `-practice` services.

`render.yaml` overrides the `render` stage CMD with `dockerCommand: node dist/server.js`, so
the practice container **serves only** — it does not migrate or seed on boot. That keeps
free-plan cold starts (15-minute spin-down, ~1 minute spin-up) from also paying the ~50s
migrate/seed/bootstrap chain. Schema changes are applied by the one-shot release job,
`npm run release:run -w @ff-restaurent/api`, the same script the Cloud Run track uses.

A fresh Prisma database must therefore be migrated **and seeded** from a workstation before
the environment is usable. Full runbook: `docs/practice-environment.md`.
