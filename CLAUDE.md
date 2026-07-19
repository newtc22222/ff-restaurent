# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FF RESTaurent is a group bill-splitting and restaurant tracker for a shared team, currently at v1.1.0-rc.1. It is a **npm workspaces monorepo** with three packages:

- `apps/api` — Fastify REST API with JWT auth, Swagger docs, and Prisma/PostgreSQL
- `apps/web` — React SPA/PWA (Vite + Tailwind CSS) with EN/VI i18n and light/dark theming
- `packages/shared` — TypeScript types, enums, bill-splitting math, and phone normalization shared across both apps

## Commands

```bash
# Run everything with Docker (recommended for first-time setup)
docker compose up --build

# Install all workspace dependencies
npm install

# IMPORTANT: Build shared package before running api or web
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

# Run only shared package tests
npm test -w @ff-restaurent/shared

# Lint and format
npm run lint
npm run format
```

API docs (Swagger UI): `http://localhost:4000/api/docs`

## Architecture

### Role System

Two independent role fields on `User`:

- `chefRole` (`null | 'SOUS_CHEF' | 'HEAD_CHEF'`) — the implicit base role is CUSTOMER. Permissions cascade:
  - **CUSTOMER**: view/mark-paid own bill shares, view restaurants, manage own favorites collection
  - **SOUS_CHEF**: + create/edit bills they own, create/edit restaurants, send reminders
  - **HEAD_CHEF**: + archive/restore bills and restaurants, change member roles, view all bills, manage the Recommended collection
- `systemRole` (`null | 'ROOT_ADMIN'`) — exactly one holder (unique constraint). Passes every chef check and additionally handles root-admin transfer (audited) and password-reset approval. Bootstrap/recovery scripts live in `apps/api/prisma/`.

Helpers `isRootAdmin`, `isSousChefOrAbove`, `isHeadChef` live in `apps/api/src/roles.ts`; auth guards in `apps/api/src/http/auth-guards.ts`. Login accepts username or phone; `sessionVersion` on `User` invalidates old JWTs. Registration requires `REGISTRATION_INVITE_CODE`. Password recovery is operator-approved (see `docs/07_PASSWORD_RECOVERY.md`).

### Bill Splitting

All money values are **integer cents** throughout the stack. The core math is in `packages/shared/src/bill-splitting.ts` (tested in `bill-splitting.test.ts`). `calculateBillSplit` distributes VAT, shipping, discounts, and vouchers across participants; `Bill.adjustmentAllocation` selects `EQUAL` or `PROPORTIONAL` allocation.

The shared package **must be built before the API or web can import from it** — it compiles TypeScript to `dist/` and the other packages import that output. In dev the `tsx` runner handles this for the API, but the web Vite dev server needs the built output.

### API Structure

`apps/api/src/app.ts` is composition-only: it registers core plugins (CORS, JWT, rate limit in production, Swagger) and then one `register*Routes` function per module from `apps/api/src/routes/` (auth, address, catalog, collection, feedback, password-reset, participant-group, profile, member, restaurant, bill, notification, stats). Services and helpers sit at `apps/api/src/` top level (`collection-service.ts`, `root-admin-service.ts`, `address-directory.ts`, `phase2-backfill.ts`, …). The `preHandler` chain is: `requireAuth` (populates `request.currentUser`) → optional `requireSousChef` / `requireHeadChef`.

Validation uses **Zod schemas** in `apps/api/src/schemas.ts`. Config comes from `loadConfig()` in `apps/api/src/config.ts`. After changing `apps/api/prisma/schema.prisma`, run `prisma:migrate` to generate a migration and regenerate the client.

Key domain models beyond users/bills: `Cuisine` + `RestaurantCuisine` (every restaurant has exactly one primary cuisine), `DiningArea`, `RestaurantPlatformLink` (typed Grab/ShopeeFood/BeFood/Gojek/… links), `Collection`/`CollectionShare`/`CollectionRestaurant` (per-user FAVORITES and one global RECOMMENDED system collection — favorites and recommendations flow through collections), `Feedback` (one per bill+user, decimal food/service ratings), `ParticipantGroup`, and audit tables (`BillAuditLog`, `RoleAuditLog`, `RootAdminTransferAudit`). Denormalized `searchText` columns back list search.

### Phase 2 migration state (FF-38) — do not break

The schema is in an **expand + dual-read/dual-write** state. Legacy fields `RestaurantEntry.cuisineType`, `links`, `isFavorite`, `isRecommended`, and the `UserFavorite` table are still written alongside the normalized replacements and **must not be dropped or stop being dual-written** until the contract gate in `releases/Phase_2_Migration_Runbook.md` passes. The idempotent backfill is `npm run prisma:phase2:backfill -w @ff-restaurent/api` (env: `PHASE2_BACKFILL_DRY_RUN`, `PHASE2_BACKFILL_REPORT_PATH`, `PHASE2_BACKFILL_BATCH_SIZE`).

### Web Structure

`apps/web/src/` is organized as:

- `app/` — `App.tsx`, hash-free state router (`router.ts`), and providers (`app-context`, `i18n`, `theme`)
- `pages/` — one component per screen (Login, Bills, BillDetail, CreateBill, Restaurants, RestaurantDetail, Collections, CollectionDetail, ParticipantGroups, Stats, Profile, Admin)
- `components/` — `ui/` primitives, `layout/`, `restaurants/`, `address/`
- `lib/` — `api.ts` (`ApiClient` class, all API calls, local response types), `session.ts`, `translations.ts`, `pwa.ts`
- `hooks/` — e.g. `useMutation`

There is no router library — navigation is driven by `router.ts` state. `VITE_API_URL` controls the API base URL. Web tests are colocated `*.test.tsx` files.

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
PROVINCES_API_URL=https://provinces.open-api.vn/api/v2/
API_PORT=4000
VITE_API_URL=http://localhost:4000
```

The address directory proxies the Vietnam provinces API (`PROVINCES_API_URL`) with in-process caching.

## Operations & Releases

- `docs/` — numbered operator guides (deployment, production runbook, phone contract, root-admin operations, password sessions/recovery)
- `releases/` — release evidence and the Phase 2 migration runbook
- `.github/workflows/` — `ci`, `staging-smoke` (also scheduled during observation windows), `backup-restore-drill`, and `phase2-production-data` (manual dry-run/apply dispatch on `main`)
